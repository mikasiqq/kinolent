import logging; logging.basicConfig(level=logging.INFO)
from scheduler.models import *
from scheduler.engine import CinemaScheduler
from datetime import time
from collections import Counter

halls = [Hall(id=f'h{i}', name=f'H{i}', capacity=200, hall_type=HallType.STANDARD_2D, cleaning_minutes=15, floor=1, open_time=time(9,0), close_time=time(23,0)) for i in range(17)]
movies = [
    Movie(id='m1', title='A', duration_minutes=180, allowed_hall_types=list(HallType), popularity_score=1.0),
    Movie(id='m2', title='B', duration_minutes=100, allowed_hall_types=list(HallType), popularity_score=0.8),
    Movie(id='m3', title='C', duration_minutes=119, allowed_hall_types=list(HallType), popularity_score=0.7),
    Movie(id='m4', title='D', duration_minutes=148, allowed_hall_types=list(HallType), popularity_score=0.8),
    Movie(id='m5', title='E', duration_minutes=165, allowed_hall_types=list(HallType), popularity_score=0.9),
    Movie(id='m6', title='F', duration_minutes=140, allowed_hall_types=list(HallType), popularity_score=0.9),
]
config = SchedulerConfig(days=[0], max_columns_per_hall_day=100, max_cg_iterations=5, ensure_all_movies_shown=True, max_shows_per_movie_per_day=11, crowding_block_minutes=9999, min_gap_same_movie_diff_halls=0)
s = CinemaScheduler(halls=halls, movies=movies, config=config)

# Check column diversity
from scheduler.column_generator import ColumnGenerator
from scheduler.demand_forecaster import DemandForecaster
cg = s.column_gen if hasattr(s, 'column_gen') else None
# Check initial columns
from collections import Counter
result = s.generate()
c = Counter(show.movie.id for show in result.all_shows)
print(f'\nShows: {len(result.all_shows)}, Movies: {dict(c)}')
print(f'Greedy: {result.solver_metrics.is_greedy_fallback}, Gap: {result.solver_metrics.gap_pct:.2f}%')
