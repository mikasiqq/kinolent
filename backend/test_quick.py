import logging, traceback
from collections import Counter
from datetime import time
logging.basicConfig(level=logging.INFO)
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
config = SchedulerConfig(days=list(range(7)), max_columns_per_hall_day=200, max_cg_iterations=30, time_slot_minutes=5, ensure_all_movies_shown=True, early_close_fraction=0.0)
try:
    print(f"Start: {len(halls)} halls x {len(movies)} movies x 7 days")
    s = CinemaScheduler(halls=halls, movies=movies, config=config)
    result = s.generate()
    m = result.solver_metrics
    shows = result.all_shows
    print(f"Shows: {len(shows)}, Revenue: {result.total_revenue/1e6:.2f}M")
    print(f"Greedy: {m.is_greedy_fallback}, Gap: {m.gap_pct:.2f}%")
    by_movie = Counter(show.movie.title for show in shows)
    print(f"\nDiversity ({len(by_movie)}/{len(movies)} movies):")
    for title, cnt in sorted(by_movie.items(), key=lambda x: -x[1]):
        print(f"  {cnt:3d}  {'#'*(cnt//3)}  {title}")
    print("\nPer day:")
    for day in range(7):
        dm = {show.movie.id for show in shows if show.day == day}
        print(f"  Day {day}: {len(dm)}/{len(movies)} movies")
except Exception as e:
    traceback.print_exc()

