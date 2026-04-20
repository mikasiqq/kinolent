"""
Тест: перебор значений diversity_bonus_weight для поиска оптимального баланса
между выручкой и разнообразием фильмов.
"""
import logging, time as time_mod
from collections import Counter
from datetime import time

logging.basicConfig(level=logging.WARNING)  # quiet for sweep

from scheduler.models import AgeRating, Hall, HallType, Movie, SchedulerConfig
from scheduler.engine import CinemaScheduler

halls = [
    Hall(id="cp_h1", name="Зал 1 Большой",  capacity=350, hall_type=HallType.STANDARD_2D, cleaning_minutes=15, floor=1, open_time=time(9,0),  close_time=time(23,30)),
    Hall(id="cp_h2", name="Зал 2 IMAX",     capacity=280, hall_type=HallType.IMAX,         cleaning_minutes=20, floor=1, open_time=time(10,0), close_time=time(23,0)),
    Hall(id="cp_h3", name="Зал 3 3D",       capacity=150, hall_type=HallType.STANDARD_3D,  cleaning_minutes=15, floor=2, open_time=time(9,0),  close_time=time(23,30)),
    Hall(id="cp_h4", name="Зал 4 VIP",      capacity=60,  hall_type=HallType.VIP,           cleaning_minutes=20, floor=3, open_time=time(11,0), close_time=time(23,0)),
    Hall(id="cp_h5", name="Зал 5 Стандарт", capacity=200, hall_type=HallType.STANDARD_2D,  cleaning_minutes=15, floor=1, open_time=time(9,0),  close_time=time(23,30)),
    Hall(id="kf_h1", name="Зал 6 Основной", capacity=250, hall_type=HallType.STANDARD_2D,  cleaning_minutes=15, floor=1, open_time=time(9,0),  close_time=time(23,0)),
    Hall(id="kf_h2", name="Зал 7 IMAX",     capacity=220, hall_type=HallType.IMAX,          cleaning_minutes=20, floor=1, open_time=time(10,0), close_time=time(23,0)),
    Hall(id="kf_h3", name="Зал 8 3D",       capacity=130, hall_type=HallType.STANDARD_3D,   cleaning_minutes=15, floor=2, open_time=time(9,0),  close_time=time(23,0)),
]
movies = [
    Movie(id="1",  title="Дюна 2",             duration_minutes=166, allowed_hall_types=list(HallType), popularity_score=0.9, age_rating=AgeRating.RATING_12),
    Movie(id="2",  title="Оппенгеймер",        duration_minutes=180, allowed_hall_types=list(HallType), popularity_score=1.0, age_rating=AgeRating.RATING_16),
    Movie(id="3",  title="Головоломка 2",      duration_minutes=100, allowed_hall_types=list(HallType), popularity_score=0.8, age_rating=AgeRating.RATING_6, is_children=True),
    Movie(id="4",  title="Чужой Ромул",        duration_minutes=119, allowed_hall_types=list(HallType), popularity_score=0.7, age_rating=AgeRating.RATING_18),
    Movie(id="5",  title="Гладиатор 2",        duration_minutes=148, allowed_hall_types=list(HallType), popularity_score=0.8, age_rating=AgeRating.RATING_16),
    Movie(id="6",  title="Интерстеллар",       duration_minutes=165, allowed_hall_types=list(HallType), popularity_score=0.9, age_rating=AgeRating.RATING_12),
    Movie(id="7",  title="Тихое место",        duration_minutes=100, allowed_hall_types=list(HallType), popularity_score=0.6, age_rating=AgeRating.RATING_16),
    Movie(id="8",  title="Гарри Поттер",       duration_minutes=140, allowed_hall_types=list(HallType), popularity_score=0.9, age_rating=AgeRating.RATING_12),
    Movie(id="9",  title="Миссия",             duration_minutes=162, allowed_hall_types=list(HallType), popularity_score=0.8, age_rating=AgeRating.RATING_16),
    Movie(id="10", title="Человек-паук",       duration_minutes=132, allowed_hall_types=list(HallType), popularity_score=0.9, age_rating=AgeRating.RATING_12),
    Movie(id="11", title="Аватар 3",           duration_minutes=185, allowed_hall_types=list(HallType), popularity_score=0.9, age_rating=AgeRating.RATING_12),
    Movie(id="12", title="Дракон",             duration_minutes=116, allowed_hall_types=list(HallType), popularity_score=0.8, age_rating=AgeRating.RATING_6, is_children=True),
    Movie(id="13", title="Формула-1",          duration_minutes=150, allowed_hall_types=list(HallType), popularity_score=0.7, age_rating=AgeRating.RATING_12),
    Movie(id="14", title="Носферату",          duration_minutes=134, allowed_hall_types=list(HallType), popularity_score=0.7, age_rating=AgeRating.RATING_18),
    Movie(id="15", title="Вонки 2",            duration_minutes=118, allowed_hall_types=list(HallType), popularity_score=0.8, age_rating=AgeRating.RATING_6, is_children=True),
    Movie(id="16", title="Трон Арес",          duration_minutes=142, allowed_hall_types=list(HallType), popularity_score=0.7, age_rating=AgeRating.RATING_12),
]

# Sweep diversity_bonus_weight values
bonus_values = [0, 1000, 3000, 5000, 10000, 20000, 50000]

print(f"{'Bonus':>8} | {'Movies':>6} | {'Avg/day':>7} | {'Min/day':>7} | {'Revenue':>10} | {'Gap%':>6} | {'Greedy':>6} | {'Time':>5} | Top-3 distribution")
print("-" * 120)

for bonus in bonus_values:
    config = SchedulerConfig(
        days=list(range(7)),
        max_columns_per_hall_day=200,
        max_cg_iterations=30,
        time_slot_minutes=5,
        ensure_all_movies_shown=False,  # now handled by diversity bonus
        early_close_fraction=0.0,
        diversity_bonus_weight=float(bonus),
    )
    t0 = time_mod.time()
    try:
        s = CinemaScheduler(halls=halls, movies=movies, config=config)
        result = s.generate()
        elapsed = time_mod.time() - t0
        m = result.solver_metrics
        shows = result.all_shows

        by_movie = Counter(show.movie.title for show in shows)
        unique_total = len(by_movie)

        per_day_unique = []
        for day in range(7):
            dm = {show.movie.id for show in shows if show.day == day}
            per_day_unique.append(len(dm))
        avg_day = sum(per_day_unique) / 7
        min_day = min(per_day_unique)

        # Revenue without diversity bonus (pure ticket revenue)
        pure_revenue = sum(show.predicted_revenue for show in shows)

        top3 = by_movie.most_common(3)
        top3_str = ", ".join(f"{t}:{c}" for t, c in top3)

        print(f"{bonus:>8} | {unique_total:>4}/16 | {avg_day:>7.1f} | {min_day:>5}/16 | {pure_revenue/1e6:>8.2f}M | {m.gap_pct:>5.1f}% | {str(m.is_greedy_fallback):>6} | {elapsed:>4.0f}s | {top3_str}")
    except Exception as e:
        elapsed = time_mod.time() - t0
        print(f"{bonus:>8} | ERROR: {e} ({elapsed:.0f}s)")
