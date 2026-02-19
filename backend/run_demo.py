#!/usr/bin/env python3
"""
run_demo.py (демонстрация работы алгоритма Column Generation для расписания кинотеатра)

Создаёт тестовый кинотеатр с 5 залами и 8 фильмами, генерирует расписание на неделю.
Запуск:  python run_demo.py
"""

from __future__ import annotations

import json
import logging
import time as time_module
from datetime import time

from scheduler.models import AgeRating, Hall, HallType, Movie, SchedulerConfig
from scheduler.engine import CinemaScheduler

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


def create_sample_halls() -> list[Hall]:
    """Создаёт 5 тестовых залов кинотеатра."""
    return [
        Hall(
            id="hall_1", name="Зал 1 (Большой)",
            capacity=350, hall_type=HallType.STANDARD_2D,
            cleaning_minutes=20, floor=1,
            open_time=time(9, 0), close_time=time(23, 30),
        ),
        Hall(
            id="hall_2", name="Зал 2 (Средний)",
            capacity=200, hall_type=HallType.STANDARD_2D,
            cleaning_minutes=15, floor=1,
            open_time=time(9, 0), close_time=time(23, 30),
        ),
        Hall(
            id="hall_3", name="Зал 3 (Малый)",
            capacity=100, hall_type=HallType.STANDARD_2D,
            cleaning_minutes=15, floor=1,
            open_time=time(10, 0), close_time=time(23, 0),
        ),
        Hall(
            id="hall_4", name="Зал 4 (IMAX)",
            capacity=280, hall_type=HallType.IMAX,
            cleaning_minutes=20, floor=2,
            open_time=time(10, 0), close_time=time(23, 30),
        ),
        Hall(
            id="hall_5", name="Зал 5 (VIP)",
            capacity=60, hall_type=HallType.VIP,
            cleaning_minutes=25, floor=2,
            open_time=time(11, 0), close_time=time(23, 0),
        ),
    ]


def create_sample_movies() -> list[Movie]:
    """Создаёт 8 тестовых фильмов для расписания."""
    return [
        Movie(
            id="mov_1", title="Дюна: Часть третья",
            duration_minutes=155, ad_block_minutes=15,
            age_rating=AgeRating.RATING_12,
            genres=["фантастика", "драма"],
            popularity_score=0.95, release_week=1,
            allowed_hall_types=[HallType.STANDARD_2D, HallType.IMAX],
            distributor_min_shows_per_day=2,
            distributor_max_copies=3,
        ),
        Movie(
            id="mov_2", title="Мстители: Секретные войны",
            duration_minutes=150, ad_block_minutes=15,
            age_rating=AgeRating.RATING_12,
            genres=["боевик", "фантастика"],
            popularity_score=0.98, release_week=1,
            allowed_hall_types=[HallType.STANDARD_2D, HallType.IMAX],
            distributor_min_shows_per_day=2,
            distributor_max_copies=3,
        ),
        Movie(
            id="mov_3", title="Головоломка 3",
            duration_minutes=105, ad_block_minutes=15,
            age_rating=AgeRating.RATING_6,
            genres=["мультфильм", "комедия"],
            popularity_score=0.85, release_week=2,
            allowed_hall_types=[HallType.STANDARD_2D],
            distributor_min_shows_per_day=1,
            distributor_max_copies=2,
            is_children=True,
        ),
        Movie(
            id="mov_4", title="Оппенгеймер 2",
            duration_minutes=170, ad_block_minutes=15,
            age_rating=AgeRating.RATING_16,
            genres=["драма", "биография"],
            popularity_score=0.70, release_week=3,
            allowed_hall_types=[HallType.STANDARD_2D, HallType.IMAX, HallType.VIP],
            distributor_min_shows_per_day=1,
            distributor_max_copies=2,
        ),
        Movie(
            id="mov_5", title="Один дома: Перезагрузка",
            duration_minutes=95, ad_block_minutes=15,
            age_rating=AgeRating.RATING_6,
            genres=["комедия", "семейный"],
            popularity_score=0.75, release_week=2,
            allowed_hall_types=[HallType.STANDARD_2D],
            distributor_min_shows_per_day=1,
            distributor_max_copies=2,
            is_children=True,
        ),
        Movie(
            id="mov_6", title="Интерстеллар: Возвращение",
            duration_minutes=165, ad_block_minutes=15,
            age_rating=AgeRating.RATING_12,
            genres=["фантастика", "драма"],
            popularity_score=0.88, release_week=1,
            allowed_hall_types=[HallType.IMAX, HallType.VIP],
            distributor_min_shows_per_day=1,
            distributor_max_copies=2,
        ),
        Movie(
            id="mov_7", title="Тихое место: День первый",
            duration_minutes=100, ad_block_minutes=15,
            age_rating=AgeRating.RATING_16,
            genres=["ужасы", "триллер"],
            popularity_score=0.65, release_week=4,
            allowed_hall_types=[HallType.STANDARD_2D, HallType.VIP],
            distributor_min_shows_per_day=1,
            distributor_max_copies=2,
        ),
        Movie(
            id="mov_8", title="Гарри Поттер: Новое поколение",
            duration_minutes=140, ad_block_minutes=15,
            age_rating=AgeRating.RATING_12,
            genres=["фэнтези", "приключения"],
            popularity_score=0.92, release_week=1,
            allowed_hall_types=[HallType.STANDARD_2D, HallType.IMAX, HallType.VIP],
            distributor_min_shows_per_day=2,
            distributor_max_copies=3,
        ),
    ]


def main() -> None:
    """Запуск демо."""
    print("\n🎬 Кинолент — Генератор расписания кинотеатра")
    print("   Алгоритм: Column Generation (SilverScheduler approach)")
    print("=" * 60)

    halls = create_sample_halls()
    movies = create_sample_movies()

    print(f"\n📍 Кинотеатр: {len(halls)} залов")
    for h in halls:
        print(f"   • {h.name}: {h.capacity} мест, тип {h.hall_type.value}, "
              f"{h.open_time.strftime('%H:%M')}-{h.close_time.strftime('%H:%M')}")

    print(f"\n🎞️  Фильмы в прокате: {len(movies)}")
    for m in movies:
        types = ", ".join(t.value for t in m.allowed_hall_types)
        print(f"   • {m.title}: {m.duration_minutes} мин, "
              f"популярность {m.popularity_score:.0%}, "
              f"неделя {m.release_week}, залы: [{types}]")

    config = SchedulerConfig(
        time_slot_minutes=10,         # 10-минутная дискретность
        max_columns_per_hall_day=200,  # ограничиваем для скорости
        max_cg_iterations=30,
        days=list(range(7)),           # вся неделя
        # Параметры из статьи SilverScheduler:
        movie_switch_penalty=100.0,    # штраф Q за смену фильма
        stagger_penalty=500.0,         # штраф R за нарушение stagger
        max_gap_between_starts=20,     # макс. 20 мин без старта фильма
        crowding_block_minutes=10,     # anti-crowding: 10-мин блоки
        min_gap_same_movie_diff_halls=60,  # мин. 60 мин между одним фильмом в разных залах
        children_movie_latest_start=1080,  # детские — не позднее 18:00
        children_preferred_latest_start=840,  # хотя бы 1 утренний показ до 14:00
        children_weekday_morning_boost=2.5,  # буст утреннего спроса на детские
        # Ограничение раннего завершения (constraint 7)
        early_close_fraction=0.3,      # 30% залов заканчивают до 23:00
        early_close_time_minutes=1380, # 23:00
        # Праздники и национальные игры (для demand model)
        active_holidays=["summer_holiday"],  # пример: летние каникулы
        national_game_days=[],                # нет дней с трансляциями
    )

    scheduler = CinemaScheduler(halls=halls, movies=movies, config=config)

    print("\n Генерация расписания...")
    start = time_module.time()
    schedule = scheduler.generate()
    elapsed = time_module.time() - start
    print(f"Готово за {elapsed:.1f} сек")

    # Вывод расписания
    scheduler.print_schedule(schedule)

    # Отчёт качества по критериям SilverScheduler
    scheduler.print_quality_report(schedule)

    # Сериализация в JSON (для фронтенда)
    schedule_dict = scheduler.to_dict(schedule)
    json_path = "schedule_output.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(schedule_dict, f, ensure_ascii=False, indent=2)
    print(f"Расписание сохранено в {json_path}")


if __name__ == "__main__":
    main()
