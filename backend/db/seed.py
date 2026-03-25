"""
db/seed.py — Начальные данные (фильмы + залы).

Вызывается при старте: если таблицы пустые — заполняет демо-данными.
"""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Hall, Movie
from .session import AsyncSessionLocal

logger = logging.getLogger(__name__)

_DEMO_MOVIES = [
    dict(
        id="1", title="Дюна: Часть вторая", original_title="Dune: Part Two",
        genre="sci-fi", duration=166, age_rating="12+", release_date="2024-03-01",
        poster_url="https://m.media-amazon.com/images/M/MV5BNTc0YmQxN2UtODAxMC00NTg1LTgzOTAtMzRjNWEwNjI4NTMyXkEyXkFqcGc@._V1_SX300.jpg",
        description="Пол Атрейдес объединяется с Чани и фрименами, вынашивая план мести заговорщикам.",
        director="Дени Вильнёв", popularity=9.0, min_shows_per_day=0, max_shows_per_day=5, is_active=True,
    ),
    dict(
        id="2", title="Оппенгеймер", original_title="Oppenheimer",
        genre="drama", duration=180, age_rating="16+", release_date="2023-07-21",
        poster_url="https://m.media-amazon.com/images/M/MV5BN2JkMDc5MGQtZjg3YS00NmFiLWIyZmQtZjBmZGMzMTRhOGM0XkEyXkFqcGc@._V1_SX300.jpg",
        description="История жизни физика Оппенгеймера и его роли в создании атомной бомбы.",
        director="Кристофер Нолан", popularity=10.0, min_shows_per_day=0, max_shows_per_day=4, is_active=True,
    ),
    dict(
        id="3", title="Головоломка 2", original_title="Inside Out 2",
        genre="animation", duration=100, age_rating="6+", release_date="2024-06-14",
        poster_url="https://m.media-amazon.com/images/M/MV5BYTc1MDQ3NjAtOWEzMi00YzE1LWI2OWEtNjQ1MDVjNjFjOGRiXkEyXkFqcGc@._V1_SX300.jpg",
        description="Райли вступает в подростковый возраст, и в её голове появляются новые эмоции.",
        director="Келси Манн", popularity=8.0, min_shows_per_day=0, max_shows_per_day=6, is_active=True,
    ),
    dict(
        id="4", title="Чужой: Ромул", original_title="Alien: Romulus",
        genre="horror", duration=119, age_rating="18+", release_date="2024-08-16",
        poster_url="https://m.media-amazon.com/images/M/MV5BMDU0NjcwOGQtNjNjOS00NzQ3LWIwM2YtYWVkMjRkMjhhNjRhXkEyXkFqcGc@._V1_SX300.jpg",
        description="Группа молодых колонистов оказывается лицом к лицу с пришельцами.",
        director="Феде Альварес", popularity=7.0, min_shows_per_day=0, max_shows_per_day=3, is_active=True,
    ),
    dict(
        id="5", title="Гладиатор 2", original_title="Gladiator II",
        genre="action", duration=148, age_rating="16+", release_date="2024-11-22",
        poster_url="https://m.media-amazon.com/images/M/MV5BNjY1NTM4MDMtOTk3YS00NzYwLTliMGYtMGE3NzZlNzNlOGU4XkEyXkFqcGc@._V1_SX300.jpg",
        description="Спустя годы после гибели Максимуса новый герой идёт на арену Рима.",
        director="Ридли Скотт", popularity=8.0, min_shows_per_day=0, max_shows_per_day=5, is_active=True,
    ),
    dict(
        id="6", title="Интерстеллар: Возвращение", original_title="Interstellar: Return",
        genre="sci-fi", duration=165, age_rating="12+", release_date="2024-12-05",
        poster_url=None,
        description="Новое путешествие сквозь червоточину в поисках нового дома для человечества.",
        director="Кристофер Нолан", popularity=9.0, min_shows_per_day=0, max_shows_per_day=4, is_active=True,
    ),
    dict(
        id="7", title="Тихое место: День первый", original_title="A Quiet Place: Day One",
        genre="horror", duration=100, age_rating="16+", release_date="2024-06-28",
        poster_url=None,
        description="Начало вторжения — первые часы апокалипсиса глазами выживших в Нью-Йорке.",
        director="Майкл Сарноски", popularity=6.0, min_shows_per_day=0, max_shows_per_day=3, is_active=True,
    ),
    dict(
        id="8", title="Гарри Поттер: Новое поколение", original_title="Harry Potter: New Generation",
        genre="fantasy", duration=140, age_rating="12+", release_date="2025-01-15",
        poster_url=None,
        description="Дети Гарри, Рона и Гермионы начинают своё первое приключение в Хогвартсе.",
        director="Дэвид Йейтс", popularity=9.0, min_shows_per_day=0, max_shows_per_day=5, is_active=True,
    ),
]

_DEMO_HALLS = [
    dict(id="h1", name="Зал 1 — Большой", capacity=300, hall_type="2D",
         cleaning_minutes=15, floor=1, open_time="09:00", close_time="23:30"),
    dict(id="h2", name="Зал 2 — IMAX", capacity=200, hall_type="IMAX",
         cleaning_minutes=20, floor=2, open_time="10:00", close_time="23:00"),
    dict(id="h3", name="Зал 3 — Комфорт", capacity=120, hall_type="3D",
         cleaning_minutes=15, floor=1, open_time="09:00", close_time="23:30"),
    dict(id="h4", name="Зал 4 — VIP", capacity=50, hall_type="VIP",
         cleaning_minutes=20, floor=3, open_time="11:00", close_time="23:00"),
]


async def seed_if_empty() -> None:
    """Заполняет БД демо-данными, если таблицы пустые."""
    async with AsyncSessionLocal() as db:
        # Проверяем фильмы
        movie_count = (await db.execute(select(Movie))).scalars().first()
        if movie_count is None:
            logger.info("Seeding demo movies...")
            for data in _DEMO_MOVIES:
                db.add(Movie(**data))
            await db.commit()
            logger.info(f"Seeded {len(_DEMO_MOVIES)} movies")

        # Проверяем залы
        hall_count = (await db.execute(select(Hall))).scalars().first()
        if hall_count is None:
            logger.info("Seeding demo halls...")
            for data in _DEMO_HALLS:
                db.add(Hall(**data))
            await db.commit()
            logger.info(f"Seeded {len(_DEMO_HALLS)} halls")
