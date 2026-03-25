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
    """Создаёт таблицы (если не существуют)."""
    # импортируем модели, чтобы Base знала о них
    from . import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
