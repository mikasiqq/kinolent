"""
db/models.py — SQLAlchemy ORM модели.

Таблицы: movies, halls, saved_schedules
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    original_title: Mapped[str | None] = mapped_column(String(255))
    genre: Mapped[str] = mapped_column(String(50), nullable=False, default="drama")
    duration: Mapped[int] = mapped_column(Integer, nullable=False)
    age_rating: Mapped[str] = mapped_column(String(10), nullable=False, default="0+")
    release_date: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    poster_url: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    director: Mapped[str | None] = mapped_column(String(255))
    popularity: Mapped[float] = mapped_column(Float, default=5.0)
    min_shows_per_day: Mapped[int] = mapped_column(Integer, default=0)
    max_shows_per_day: Mapped[int] = mapped_column(Integer, default=5)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Hall(Base):
    __tablename__ = "halls"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    hall_type: Mapped[str] = mapped_column(String(20), nullable=False, default="2D")
    cleaning_minutes: Mapped[int] = mapped_column(Integer, default=15)
    floor: Mapped[int] = mapped_column(Integer, default=1)
    open_time: Mapped[str] = mapped_column(String(5), default="09:00")
    close_time: Mapped[str] = mapped_column(String(5), default="23:30")


class SavedSchedule(Base):
    __tablename__ = "saved_schedules"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    days: Mapped[int] = mapped_column(Integer, nullable=False)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    total_revenue: Mapped[float] = mapped_column(Float, default=0.0)
    total_attendance: Mapped[int] = mapped_column(Integer, default=0)
    total_shows: Mapped[int] = mapped_column(Integer, default=0)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="viewer")  # admin | manager | viewer
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ScheduleRating(Base):
    __tablename__ = "schedule_ratings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    schedule_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
