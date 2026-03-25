"""
api/routes/schedules_db.py — Хранение истории расписаний в БД.

GET    /api/schedules              — список (с полными данными)
GET    /api/schedules/{id}         — конкретное расписание
POST   /api/schedules              — сохранить расписание
PATCH  /api/schedules/{id}         — обновить (имя, данные)
DELETE /api/schedules/{id}         — удалить расписание
POST   /api/schedules/{id}/rate    — оценить расписание
GET    /api/schedules/{id}/ratings — рейтинги расписания
POST   /api/schedules/recalculate  — пересчитать прогнозы посещаемости/выручки
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user, require_any, require_manager
from db.models import Hall as HallDB, Movie as MovieDB, SavedSchedule, ScheduleRating, User
from db.session import get_db
from scheduler.demand_forecaster import DemandForecaster
from scheduler.models import Hall as SchedHall, Movie as SchedMovie, SchedulerConfig

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


# ── Схемы ────────────────────────────────────────────────────────────────────

class ScheduleSaveBody(BaseModel):
    id: str
    name: str
    createdAt: str
    days: int
    data: dict[str, Any]
    totalRevenue: float
    totalAttendance: int
    totalShows: int


class SchedulePatchBody(BaseModel):
    name: str | None = None
    data: dict[str, Any] | None = None
    totalRevenue: float | None = None
    totalAttendance: int | None = None
    totalShows: int | None = None


class RatingBody(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = None


class RecalcShowIn(BaseModel):
    id: str
    movieId: str
    hallId: str
    day: int
    startMinutes: int
    endMinutes: int
    adBlockMinutes: int = 15


class RecalcRequest(BaseModel):
    shows: list[RecalcShowIn]


# ── Эндпоинты ────────────────────────────────────────────────────────────────

@router.get("", dependencies=[Depends(require_any)])
async def list_schedules(db: AsyncSession = Depends(get_db)):
    """Возвращает все расписания с полными данными (для восстановления стора)."""
    result = await db.execute(
        select(SavedSchedule).order_by(SavedSchedule.created_at.desc())
    )
    schedules = result.scalars().all()
    return [s.data for s in schedules]


@router.get("/{schedule_id}", dependencies=[Depends(require_any)])
async def get_schedule(schedule_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SavedSchedule).where(SavedSchedule.id == schedule_id)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Schedule not found")
    return s.data


@router.post("", status_code=201, dependencies=[Depends(require_manager)])
async def save_schedule(
    body: ScheduleSaveBody, db: AsyncSession = Depends(get_db)
):
    # Если уже существует — обновляем
    result = await db.execute(
        select(SavedSchedule).where(SavedSchedule.id == body.id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.data = body.data
        existing.total_revenue = body.totalRevenue
        existing.total_attendance = body.totalAttendance
        existing.total_shows = body.totalShows
    else:
        s = SavedSchedule(
            id=body.id,
            name=body.name,
            days=body.days,
            data=body.data,
            total_revenue=body.totalRevenue,
            total_attendance=body.totalAttendance,
            total_shows=body.totalShows,
        )
        db.add(s)

    await db.commit()
    return {"id": body.id}


@router.delete("/{schedule_id}", status_code=204, dependencies=[Depends(require_manager)])
async def delete_schedule(schedule_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SavedSchedule).where(SavedSchedule.id == schedule_id)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Schedule not found")
    await db.delete(s)
    await db.commit()


# ── POST /recalculate — пересчёт прогнозов ────────────────────────────────────

@router.post("/recalculate", dependencies=[Depends(require_any)])
async def recalculate_predictions(
    body: RecalcRequest, db: AsyncSession = Depends(get_db)
):
    """
    Пересчитывает прогнозы посещаемости и выручки для списка сеансов,
    используя модель DemandForecaster (SilverScheduler).
    Возвращает обновлённые predictedAttendance / predictedRevenue / totals.
    """
    # Загрузить фильмы и залы из БД
    movie_ids = list({s.movieId for s in body.shows})
    hall_ids = list({s.hallId for s in body.shows})

    movies_result = await db.execute(select(MovieDB).where(MovieDB.id.in_(movie_ids)))
    halls_result = await db.execute(select(HallDB).where(HallDB.id.in_(hall_ids)))

    db_movies = {m.id: m for m in movies_result.scalars().all()}
    db_halls = {h.id: h for h in halls_result.scalars().all()}

    # Конвертировать DB-модели → scheduler-модели
    sched_movies: dict[str, SchedMovie] = {}
    for mid, m in db_movies.items():
        is_child = m.age_rating in ("0+", "6+")
        sched_movies[mid] = SchedMovie(
            id=m.id,
            title=m.title,
            duration_minutes=m.duration,
            ad_block_minutes=15,
            popularity_score=m.popularity / 10.0,  # DB: 1-10, model: 0-1
            release_week=1,
            is_children=is_child,
            genres=[m.genre] if m.genre else [],
        )

    sched_halls: dict[str, SchedHall] = {}
    for hid, h in db_halls.items():
        sched_halls[hid] = SchedHall(
            id=h.id,
            name=h.name,
            capacity=h.capacity,
        )

    # Создать прогнозист
    config = SchedulerConfig()
    forecaster = DemandForecaster(config=config)

    # Пересчитать каждый сеанс
    results: list[dict] = []
    total_revenue = 0.0
    total_attendance = 0

    for show_in in body.shows:
        movie = sched_movies.get(show_in.movieId)
        hall = sched_halls.get(show_in.hallId)

        if not movie or not hall:
            # Если не найден — оставляем нули
            results.append({
                "id": show_in.id,
                "predictedAttendance": 0,
                "predictedRevenue": 0,
            })
            continue

        attendance = forecaster.predict_attendance(
            movie, hall, show_in.day, show_in.startMinutes
        )
        revenue = forecaster.predict_revenue(
            movie, hall, show_in.day, show_in.startMinutes
        )

        att = round(attendance)
        rev = round(revenue, 2)
        total_attendance += att
        total_revenue += rev

        results.append({
            "id": show_in.id,
            "predictedAttendance": att,
            "predictedRevenue": rev,
        })

    return {
        "shows": results,
        "totalAttendance": total_attendance,
        "totalRevenue": round(total_revenue, 2),
    }


# ── PATCH — обновить расписание ────────────────────────────────────────────────

@router.patch("/{schedule_id}", dependencies=[Depends(require_manager)])
async def patch_schedule(
    schedule_id: str, body: SchedulePatchBody, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SavedSchedule).where(SavedSchedule.id == schedule_id)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Schedule not found")

    if body.name is not None:
        s.name = body.name
        # Also update name inside the JSON blob
        if s.data and isinstance(s.data, dict):
            s.data = {**s.data, "name": body.name}
    if body.data is not None:
        s.data = body.data
    if body.totalRevenue is not None:
        s.total_revenue = body.totalRevenue
    if body.totalAttendance is not None:
        s.total_attendance = body.totalAttendance
    if body.totalShows is not None:
        s.total_shows = body.totalShows

    await db.commit()
    await db.refresh(s)
    return s.data


# ── Оценки расписания ─────────────────────────────────────────────────────────

@router.post("/{schedule_id}/rate", status_code=201, dependencies=[Depends(require_any)])
async def rate_schedule(
    schedule_id: str,
    body: RatingBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Проверяем, что расписание существует
    sched = (await db.execute(
        select(SavedSchedule).where(SavedSchedule.id == schedule_id)
    )).scalar_one_or_none()
    if not sched:
        raise HTTPException(404, "Schedule not found")

    # Upsert: один пользователь — одна оценка на расписание
    existing = (await db.execute(
        select(ScheduleRating).where(
            ScheduleRating.schedule_id == schedule_id,
            ScheduleRating.user_id == user.id,
        )
    )).scalar_one_or_none()

    if existing:
        existing.rating = body.rating
        existing.comment = body.comment
    else:
        r = ScheduleRating(
            schedule_id=schedule_id,
            user_id=user.id,
            rating=body.rating,
            comment=body.comment,
        )
        db.add(r)

    await db.commit()

    # Возвращаем среднюю оценку
    avg_result = await db.execute(
        select(sa_func.avg(ScheduleRating.rating), sa_func.count(ScheduleRating.id))
        .where(ScheduleRating.schedule_id == schedule_id)
    )
    avg_row = avg_result.one()
    return {
        "averageRating": round(float(avg_row[0] or 0), 1),
        "totalRatings": avg_row[1],
        "myRating": body.rating,
        "myComment": body.comment,
    }


@router.get("/{schedule_id}/ratings", dependencies=[Depends(require_any)])
async def get_ratings(
    schedule_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Средняя оценка
    avg_result = await db.execute(
        select(sa_func.avg(ScheduleRating.rating), sa_func.count(ScheduleRating.id))
        .where(ScheduleRating.schedule_id == schedule_id)
    )
    avg_row = avg_result.one()

    # Моя оценка
    my = (await db.execute(
        select(ScheduleRating).where(
            ScheduleRating.schedule_id == schedule_id,
            ScheduleRating.user_id == user.id,
        )
    )).scalar_one_or_none()

    # Все оценки с именами
    rows = (await db.execute(
        select(ScheduleRating, User.name)
        .join(User, ScheduleRating.user_id == User.id)
        .where(ScheduleRating.schedule_id == schedule_id)
        .order_by(ScheduleRating.created_at.desc())
    )).all()

    return {
        "averageRating": round(float(avg_row[0] or 0), 1),
        "totalRatings": avg_row[1],
        "myRating": my.rating if my else None,
        "myComment": my.comment if my else None,
        "ratings": [
            {
                "id": r.ScheduleRating.id,
                "userName": r.name,
                "rating": r.ScheduleRating.rating,
                "comment": r.ScheduleRating.comment,
                "createdAt": r.ScheduleRating.created_at.isoformat() if r.ScheduleRating.created_at else "",
            }
            for r in rows
        ],
    }
