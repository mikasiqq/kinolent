"""
One-off utility: rebalance catalog in DB.
- Keep 8 halls total (5 for org_cinema_park, 3 for org_karo_spb)
- Ensure at least 16 movies (adds demo movies if needed)

Run:
  python3 db/rebalance_catalog.py
"""
from __future__ import annotations

import asyncio
from typing import Iterable

from sqlalchemy import select

from db.models import Hall, Movie
from db.session import AsyncSessionLocal

TARGET_HALL_IDS = {
    "cp_h1", "cp_h2", "cp_h3", "cp_h4", "cp_h5",
    "kf_h1", "kf_h2", "kf_h3",
}

EXTRA_MOVIES = [
    dict(id="9", title="Миссия невыполнима: Финальная расплата", original_title="Mission: Impossible — Final Reckoning", genre="action", duration=162, age_rating="16+", release_date="2025-05-23", poster_url=None, description="Итан Хант выходит на последнее задание против глобальной цифровой угрозы.", director="Кристофер Маккуорри", popularity=8.0, min_shows_per_day=0, max_shows_per_day=4, is_active=True),
    dict(id="10", title="Человек-паук: За пределами вселенных", original_title="Spider-Man: Beyond the Spider-Verse", genre="animation", duration=132, age_rating="12+", release_date="2025-11-07", poster_url=None, description="Майлз Моралес сталкивается с последствиями разрушения канона мультивселенной.", director="Жуакин душ Сантуш", popularity=9.0, min_shows_per_day=0, max_shows_per_day=5, is_active=True),
    dict(id="11", title="Аватар: Огонь и пепел", original_title="Avatar: Fire and Ash", genre="sci-fi", duration=185, age_rating="12+", release_date="2025-12-19", poster_url=None, description="Новая глава саги о Пандоре и противостоянии кланов На'ви.", director="Джеймс Кэмерон", popularity=9.0, min_shows_per_day=0, max_shows_per_day=4, is_active=True),
    dict(id="12", title="Как приручить дракона", original_title="How to Train Your Dragon", genre="family", duration=116, age_rating="6+", release_date="2025-06-13", poster_url=None, description="Игровая адаптация истории Иккинга и Беззубика.", director="Дин ДеБлуа", popularity=8.0, min_shows_per_day=0, max_shows_per_day=6, is_active=True),
    dict(id="13", title="Формула-1", original_title="F1", genre="drama", duration=150, age_rating="12+", release_date="2025-06-27", poster_url=None, description="Ветеран автоспорта возвращается в королевские гонки и становится наставником новичка.", director="Джозеф Косински", popularity=7.0, min_shows_per_day=0, max_shows_per_day=4, is_active=True),
    dict(id="14", title="Носферату", original_title="Nosferatu", genre="horror", duration=134, age_rating="18+", release_date="2025-01-03", poster_url=None, description="Готическая история о древнем вампире и одержимости.", director="Роберт Эггерс", popularity=7.0, min_shows_per_day=0, max_shows_per_day=3, is_active=True),
    dict(id="15", title="Вонки 2", original_title="Wonka 2", genre="family", duration=118, age_rating="6+", release_date="2025-12-05", poster_url=None, description="Новые приключения Вилли Вонки и его фабрики чудес.", director="Пол Кинг", popularity=8.0, min_shows_per_day=0, max_shows_per_day=5, is_active=True),
    dict(id="16", title="Трон: Арес", original_title="TRON: Ares", genre="sci-fi", duration=142, age_rating="12+", release_date="2025-10-10", poster_url=None, description="Программа из цифрового мира попадает в реальность, меняя правила игры.", director="Йоахим Рённинг", popularity=7.0, min_shows_per_day=0, max_shows_per_day=4, is_active=True),
]


async def main() -> None:
    async with AsyncSessionLocal() as db:
        halls = (await db.execute(select(Hall))).scalars().all()
        to_delete = [h for h in halls if h.id not in TARGET_HALL_IDS]
        for h in to_delete:
            await db.delete(h)

        movies = (await db.execute(select(Movie))).scalars().all()
        existing_ids = {m.id for m in movies}

        for data in EXTRA_MOVIES:
            if data["id"] not in existing_ids:
                db.add(Movie(**data))

        await db.commit()

        final_halls = (await db.execute(select(Hall))).scalars().all()
        final_movies = (await db.execute(select(Movie))).scalars().all()

        print(f"Halls: {len(final_halls)}")
        print(f"Movies: {len(final_movies)}")
        print("Hall IDs:", ", ".join(sorted(h.id for h in final_halls)))


if __name__ == "__main__":
    asyncio.run(main())
