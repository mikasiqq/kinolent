"""
db/session.py — Async SQLAlchemy engine + session factory.
"""
from __future__ import annotations

import os

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .base import Base

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://kinolent:kinolent@localhost:5432/kinolent",
)

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    """FastAPI Depends — выдаёт сессию на запрос."""
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """Создаёт таблицы (если не существуют) и выполняет миграции."""
    # импортируем модели, чтобы Base знала о них
    from . import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Миграция: добавить новые колонки в saved_schedules (если отсутствуют)
    async with engine.begin() as conn:
        from sqlalchemy import text
        # saved_schedules migrations
        for col, col_type, default in [
            ("start_date", "VARCHAR(10)", "NULL"),
            ("end_date", "VARCHAR(10)", "NULL"),
            ("is_archived", "BOOLEAN", "FALSE"),
            ("org_id", "VARCHAR", "NULL"),
        ]:
            try:
                await conn.execute(text(
                    f"ALTER TABLE saved_schedules ADD COLUMN {col} {col_type} DEFAULT {default}"
                ))
            except Exception:
                pass

        # org_id for movies, halls, users
        for table in ("movies", "halls", "users"):
            try:
                await conn.execute(text(
                    f"ALTER TABLE {table} ADD COLUMN org_id VARCHAR DEFAULT NULL"
                ))
            except Exception:
                pass  # Колонка уже существует
