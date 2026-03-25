"""
api/routes/schedules_db.py — Хранение истории расписаний в БД.

GET    /api/schedules              — список (с полными данными)
GET    /api/schedules/{id}         — конкретное расписание
POST   /api/schedules              — сохранить расписание
PATCH  /api/schedules/{id}         — обновить (имя, данные)
DELETE /api/schedules/{id}         — удалить расписание
POST   /api/schedules/{id}/rate    — оценить расписание
GET    /api/schedules/{id}/ratings — рейтинги расписания
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user, require_any, require_manager
from db.models import SavedSchedule, ScheduleRating, User
from db.session import get_db

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
