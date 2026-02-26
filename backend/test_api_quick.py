"""Быстрый тест API pipeline."""
from api.schemas import GenerateRequest, MovieIn
from api.converters import hall_from_dto, movie_from_dto, config_from_request
from api.main import _get_demo_movies
from scheduler.engine import CinemaScheduler

req = GenerateRequest.model_validate({
    "scheduleName": "Test",
    "days": 1,
    "halls": [{"id": "h1", "name": "Hall 1", "capacity": 100, "hallType": "2D",
               "cleaningMinutes": 15, "openTime": "10:00", "closeTime": "22:00", "enabled": True}],
    "staggerMinutes": 10,
    "maxColumnsPerIteration": 50,
    "lpTimeLimitSeconds": 10,
    "antiCrowding": False,
    "childrenDaytimeOnly": True,
})

halls = [hall_from_dto(h) for h in req.halls if h.enabled]
movie_dtos = _get_demo_movies()
movies = [movie_from_dto(m) for m in movie_dtos if m.is_active]
config = config_from_request(req)

print(f"Halls: {len(halls)}")
print(f"Movies: {len(movies)}")
print(f"Days: {config.days}")

scheduler = CinemaScheduler(halls=halls, movies=movies, config=config)
schedule = scheduler.generate()
print(f"Shows: {len(schedule.all_shows)}")
print(f"Revenue: {schedule.total_revenue:.0f}")

# Test serialization
from api.main import _build_schedule_out
quality = scheduler.quality_report(schedule)
result = _build_schedule_out(schedule, req, movie_dtos, quality, 1000.0)
print(f"Schedule ID: {result.id}")
print(f"Total shows (output): {result.total_shows}")
print(f"Quality gap: {result.quality_report.optimality_gap_pct}%")
print("ALL OK!")
