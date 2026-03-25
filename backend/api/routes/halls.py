"""
api/routes/halls.py — CRUD для залов.

GET    /api/halls          — список всех залов
POST   /api/halls          — создать зал
PUT    /api/halls/{id}     — обновить зал
DELETE /api/halls/{id}     — удалить зал
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Hall
from db.session import get_db

router = APIRouter(prefix="/api/halls", tags=["halls"])


# ── Схемы ────────────────────────────────────────────────────────────────────

class HallBody(BaseModel):
    name: str
    capacity: int
    hallType: str = "2D"
    cleaningMinutes: int = 15
    floor: int = 1
    openTime: str = "09:00"
    closeTime: str = "23:30"


class HallOut(BaseModel):
    id: str
    name: str
    capacity: int
    hallType: str
    cleaningMinutes: int
    floor: int
    openTime: str
    closeTime: str


def _to_out(h: Hall) -> HallOut:
    return HallOut(
        id=h.id,
        name=h.name,
        capacity=h.capacity,
        hallType=h.hall_type,
        cleaningMinutes=h.cleaning_minutes,
        floor=h.floor,
        openTime=h.open_time,
        closeTime=h.close_time,
    )


# ── Эндпоинты ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[HallOut])
async def list_halls(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Hall))
    return [_to_out(h) for h in result.scalars().all()]


@router.post("", response_model=HallOut, status_code=201)
async def create_hall(body: HallBody, db: AsyncSession = Depends(get_db)):
    hall = Hall(
        name=body.name,
        capacity=body.capacity,
        hall_type=body.hallType,
        cleaning_minutes=body.cleaningMinutes,
        floor=body.floor,
        open_time=body.openTime,
        close_time=body.closeTime,
    )
    db.add(hall)
    await db.commit()
    await db.refresh(hall)
    return _to_out(hall)


@router.put("/{hall_id}", response_model=HallOut)
async def update_hall(
    hall_id: str, body: HallBody, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Hall).where(Hall.id == hall_id))
    hall = result.scalar_one_or_none()
    if not hall:
        raise HTTPException(404, "Hall not found")

    hall.name = body.name
    hall.capacity = body.capacity
    hall.hall_type = body.hallType
    hall.cleaning_minutes = body.cleaningMinutes
    hall.floor = body.floor
    hall.open_time = body.openTime
    hall.close_time = body.closeTime

    await db.commit()
    await db.refresh(hall)
    return _to_out(hall)


@router.delete("/{hall_id}", status_code=204)
async def delete_hall(hall_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Hall).where(Hall.id == hall_id))
    hall = result.scalar_one_or_none()
    if not hall:
        raise HTTPException(404, "Hall not found")
    await db.delete(hall)
    await db.commit()
