"""Test with REAL DB data to see actual diversity."""
import asyncio, logging
logging.basicConfig(level=logging.INFO)
from db.session import AsyncSessionLocal
from sqlalchemy import text
from api.converters import movie_from_dto, hall_from_dto, config_from_request
from api.schemas import MovieIn, HallConfigIn, GenerateRequest
from scheduler.engine import CinemaScheduler
from collections import Counter

async def main():
    async with AsyncSessionLocal() as s:
        r = await s.execute(text(
            "SELECT id, title, duration, age_rating, genre, popularity, "
            "min_shows_per_day, max_shows_per_day, is_active, poster_url "
            "FROM movies WHERE is_active=true"
        ))
        rows = r.fetchall()
        movie_dtos = []
        for row in rows:
            movie_dtos.append(MovieIn(
                id=str(row[0]), title=row[1], duration=row[2],
                ageRating=row[3] or '12+', genre=row[4] or 'drama',
                popularity=float(row[5]),
                minShowsPerDay=row[6] or 0, maxShowsPerDay=row[7] or 99,
                isActive=True, posterUrl=row[9],
            ))

        r = await s.execute(text(
            "SELECT id, name, capacity, hall_type, cleaning_minutes, floor, "
            "open_time, close_time FROM halls"
        ))
        hrows = r.fetchall()
        hall_dtos = []
        for h in hrows:
            hall_dtos.append(HallConfigIn(
                id=str(h[0]), name=h[1], capacity=h[2], hallType=h[3],
                cleaningMinutes=h[4] or 15, floor=h[5] or 1,
                openTime=str(h[6])[:5], closeTime=str(h[7])[:5], enabled=True,
            ))

    movies = [movie_from_dto(d) for d in movie_dtos]
    halls = [hall_from_dto(d) for d in hall_dtos if d.enabled]

    req = GenerateRequest(
        scheduleName='test', days=7, halls=hall_dtos,
        staggerMinutes=5, maxColumnsPerIteration=100,
        lpTimeLimitSeconds=30, childrenDaytimeOnly=True,
    )
    config = config_from_request(req)

    print(f"Movies: {len(movies)}, Halls: {len(halls)}")
    for m in movies:
        print(f"  {m.title}: pop={m.popularity_score:.2f}, copies={m.distributor_max_copies}")

    sched = CinemaScheduler(halls=halls, movies=movies, config=config)
    result = sched.generate()

    shows = result.all_shows
    by_movie = Counter(show.movie.title for show in shows)
    print(f"\nShows: {len(shows)}, Revenue: {result.total_revenue/1e6:.2f}M")
    m = result.solver_metrics
    print(f"Greedy: {m.is_greedy_fallback}, Gap: {m.gap_pct:.2f}%")
    print(f"Diversity ({len(by_movie)}/{len(movies)} movies):")
    for title, cnt in sorted(by_movie.items(), key=lambda x: -x[1]):
        print(f"  {cnt:3d}  {title}")

    print("\nPer day:")
    for day in range(7):
        dm = {show.movie.id for show in shows if show.day == day}
        print(f"  Day {day}: {len(dm)}/{len(movies)} movies")

asyncio.run(main())
