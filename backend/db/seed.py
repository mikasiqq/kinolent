"""
db/seed.py — Начальные данные (фильмы + залы).

Вызывается при старте: если таблицы пустые — заполняет демо-данными.
"""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Hall, Movie, Organization, User
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
    dict(
        id="9", title="Миссия невыполнима: Финальная расплата", original_title="Mission: Impossible — Final Reckoning",
        genre="action", duration=162, age_rating="16+", release_date="2025-05-23",
        poster_url=None,
        description="Итан Хант выходит на последнее задание против глобальной цифровой угрозы.",
        director="Кристофер Маккуорри", popularity=8.0, min_shows_per_day=0, max_shows_per_day=4, is_active=True,
    ),
    dict(
        id="10", title="Человек-паук: За пределами вселенных", original_title="Spider-Man: Beyond the Spider-Verse",
        genre="animation", duration=132, age_rating="12+", release_date="2025-11-07",
        poster_url=None,
        description="Майлз Моралес сталкивается с последствиями разрушения канона мультивселенной.",
        director="Жуакин душ Сантуш", popularity=9.0, min_shows_per_day=0, max_shows_per_day=5, is_active=True,
    ),
    dict(
        id="11", title="Аватар: Огонь и пепел", original_title="Avatar: Fire and Ash",
        genre="sci-fi", duration=185, age_rating="12+", release_date="2025-12-19",
        poster_url=None,
        description="Новая глава саги о Пандоре и противостоянии кланов На'ви.",
        director="Джеймс Кэмерон", popularity=9.0, min_shows_per_day=0, max_shows_per_day=4, is_active=True,
    ),
    dict(
        id="12", title="Как приручить дракона", original_title="How to Train Your Dragon",
        genre="family", duration=116, age_rating="6+", release_date="2025-06-13",
        poster_url=None,
        description="Игровая адаптация истории Иккинга и Беззубика.",
        director="Дин ДеБлуа", popularity=8.0, min_shows_per_day=0, max_shows_per_day=6, is_active=True,
    ),
    dict(
        id="13", title="Формула-1", original_title="F1",
        genre="drama", duration=150, age_rating="12+", release_date="2025-06-27",
        poster_url=None,
        description="Ветеран автоспорта возвращается в королевские гонки и становится наставником новичка.",
        director="Джозеф Косински", popularity=7.0, min_shows_per_day=0, max_shows_per_day=4, is_active=True,
    ),
    dict(
        id="14", title="Носферату", original_title="Nosferatu",
        genre="horror", duration=134, age_rating="18+", release_date="2025-01-03",
        poster_url=None,
        description="Готическая история о древнем вампире и одержимости.",
        director="Роберт Эггерс", popularity=7.0, min_shows_per_day=0, max_shows_per_day=3, is_active=True,
    ),
    dict(
        id="15", title="Вонки 2", original_title="Wonka 2",
        genre="family", duration=118, age_rating="6+", release_date="2025-12-05",
        poster_url=None,
        description="Новые приключения Вилли Вонки и его фабрики чудес.",
        director="Пол Кинг", popularity=8.0, min_shows_per_day=0, max_shows_per_day=5, is_active=True,
    ),
    dict(
        id="16", title="Трон: Арес", original_title="TRON: Ares",
        genre="sci-fi", duration=142, age_rating="12+", release_date="2025-10-10",
        poster_url=None,
        description="Программа из цифрового мира попадает в реальность, меняя правила игры.",
        director="Йоахим Рённинг", popularity=7.0, min_shows_per_day=0, max_shows_per_day=4, is_active=True,
    ),
]

_DEMO_HALLS: list[dict] = []


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

        # Создаём admin-пользователя если нет ни одного
        user_count = (await db.execute(select(User))).scalars().first()
        if user_count is None:
            from passlib.context import CryptContext
            pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
            admin = User(
                email="admin@kinolent.ru",
                name="Администратор",
                password_hash=pwd_ctx.hash("admin123"),
                role="admin",
            )
            db.add(admin)
            await db.commit()
            logger.info("Seeded default admin: admin@kinolent.ru / admin123")

        # Создаём демо-организации если их нет
        org_count = (await db.execute(select(Organization))).scalars().first()
        if org_count is None:
            await _seed_organizations(db)


async def _seed_organizations(db: AsyncSession) -> None:
    """Создаёт 2 демо-организации с залами и пользователями."""
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

    # ── Организация 1: Синема Парк Москва ─────────────────────────────────

    org1 = Organization(
        id="org_cinema_park",
        name="Синема Парк Москва",
        slug="cinema-park-moscow",
        description="Крупнейшая сеть кинотеатров в Москве. 5 залов, включая IMAX и VIP.",
        address="Москва, ул. Охотный Ряд, д. 2",
    )
    db.add(org1)

    # Залы Синема Парк (5 залов)
    org1_halls = [
        Hall(id="cp_h1", org_id="org_cinema_park", name="Зал 1 — Большой", capacity=350, hall_type="2D", cleaning_minutes=15, floor=1, open_time="09:00", close_time="23:30"),
        Hall(id="cp_h2", org_id="org_cinema_park", name="Зал 2 — IMAX", capacity=280, hall_type="IMAX", cleaning_minutes=20, floor=1, open_time="10:00", close_time="23:00"),
        Hall(id="cp_h3", org_id="org_cinema_park", name="Зал 3 — Комфорт", capacity=150, hall_type="3D", cleaning_minutes=15, floor=2, open_time="09:00", close_time="23:30"),
        Hall(id="cp_h4", org_id="org_cinema_park", name="Зал 4 — VIP", capacity=60, hall_type="VIP", cleaning_minutes=20, floor=3, open_time="11:00", close_time="23:00"),
        Hall(id="cp_h5", org_id="org_cinema_park", name="Зал 5 — Стандарт", capacity=200, hall_type="2D", cleaning_minutes=15, floor=1, open_time="09:00", close_time="23:30"),
    ]
    for h in org1_halls:
        db.add(h)

    # Пользователи Синема Парк (5 менеджеров)
    org1_users = [
        User(org_id="org_cinema_park", email="ivanov@cinemapark.ru", name="Иванов Пётр", password_hash=pwd_ctx.hash("pass123"), role="manager"),
        User(org_id="org_cinema_park", email="petrova@cinemapark.ru", name="Петрова Мария", password_hash=pwd_ctx.hash("pass123"), role="manager"),
        User(org_id="org_cinema_park", email="sidorov@cinemapark.ru", name="Сидоров Алексей", password_hash=pwd_ctx.hash("pass123"), role="manager"),
        User(org_id="org_cinema_park", email="kozlova@cinemapark.ru", name="Козлова Елена", password_hash=pwd_ctx.hash("pass123"), role="viewer"),
        User(org_id="org_cinema_park", email="novikov@cinemapark.ru", name="Новиков Дмитрий", password_hash=pwd_ctx.hash("pass123"), role="viewer"),
    ]
    for u in org1_users:
        db.add(u)

    # ── Организация 2: Каро Фильм СПб ────────────────────────────────────

    org2 = Organization(
        id="org_karo_spb",
        name="Каро Фильм СПб",
        slug="karo-film-spb",
        description="Сеть кинотеатров Каро Фильм в Санкт-Петербурге. 3 зала с современным оборудованием.",
        address="Санкт-Петербург, Невский пр., д. 114",
    )
    db.add(org2)

    # Залы Каро Фильм (3 зала)
    org2_halls = [
        Hall(id="kf_h1", org_id="org_karo_spb", name="Зал 1 — Основной", capacity=250, hall_type="2D", cleaning_minutes=15, floor=1, open_time="09:00", close_time="23:00"),
        Hall(id="kf_h2", org_id="org_karo_spb", name="Зал 2 — IMAX", capacity=220, hall_type="IMAX", cleaning_minutes=20, floor=1, open_time="10:00", close_time="23:00"),
        Hall(id="kf_h3", org_id="org_karo_spb", name="Зал 3 — 3D", capacity=130, hall_type="3D", cleaning_minutes=15, floor=2, open_time="09:00", close_time="23:00"),
    ]
    for h in org2_halls:
        db.add(h)

    # Пользователи Каро Фильм (3 менеджера)
    org2_users = [
        User(org_id="org_karo_spb", email="smirnov@karofilm.ru", name="Смирнов Андрей", password_hash=pwd_ctx.hash("pass123"), role="manager"),
        User(org_id="org_karo_spb", email="volkova@karofilm.ru", name="Волкова Анна", password_hash=pwd_ctx.hash("pass123"), role="manager"),
        User(org_id="org_karo_spb", email="morozov@karofilm.ru", name="Морозов Игорь", password_hash=pwd_ctx.hash("pass123"), role="viewer"),
    ]
    for u in org2_users:
        db.add(u)

    await db.commit()
    logger.info("Seeded 2 demo organizations: Синема Парк Москва (5 halls, 5 users), Каро Фильм СПб (3 halls, 3 users)")
