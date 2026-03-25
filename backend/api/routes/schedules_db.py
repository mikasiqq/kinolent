"""
api/routes/schedules_db.py — Хранение истории расписаний в БД.

GET    /api/schedules          — список (с полными данными)
GET    /api/schedules/{id}     — конкретное расписание
POST   /api/schedules          — сохранить расписание
DELETE /api/schedules/{id}     — удалить расписание
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import require_any, require_manager
from db.models import SavedSchedule
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
