"""
update_posters.py — обновляет poster_url у всех фильмов в БД через Kinopoisk API.
Запуск: python update_posters.py
"""
import asyncio
import os
import httpx
from sqlalchemy import text
from db.session import engine

KP_KEY = os.getenv("KP_API_KEY", "d54d28f4-db4e-4625-8ade-9dab0c844b36")
HEADERS = {"X-API-KEY": KP_KEY, "accept": "application/json"}
SEARCH_URL = "https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword"


async def search_poster(client: httpx.AsyncClient, title: str) -> str | None:
    """Ищет фильм по названию, возвращает лучший доступный постер."""
    try:
        r = await client.get(SEARCH_URL, params={"keyword": title, "page": 1}, headers=HEADERS)
        if r.status_code != 200:
            print(f"  [!] KP HTTP {r.status_code} для «{title}»")
            return None
        films = r.json().get("films", [])
        if not films:
            return None
        film = films[0]
        # posterUrl — большой постер, posterUrlPreview — меньший
        return film.get("posterUrl") or film.get("posterUrlPreview")
    except Exception as e:
        print(f"  [!] Ошибка запроса для «{title}»: {e}")
        return None


async def main():
    async with engine.connect() as conn:
        rows = await conn.execute(text("SELECT id, title, poster_url FROM movies ORDER BY title"))
        movies = rows.fetchall()

    print(f"Найдено {len(movies)} фильмов. Запрашиваем постеры...\n")

    updates: list[tuple[str, str]] = []  # (id, new_poster_url)

    async with httpx.AsyncClient(timeout=15) as client:
        for movie in movies:
            poster = await search_poster(client, movie.title)
            if poster:
                updates.append((movie.id, poster))
                changed = "(заменён)" if movie.poster_url and movie.poster_url != poster else "(добавлен)" if not movie.poster_url else ""
                print(f"  ✓ {movie.title}: {poster[:70]} {changed}")
            else:
                print(f"  ✗ {movie.title}: постер не найден, оставляем как есть")

    if not updates:
        print("\nНет обновлений.")
        return

    print(f"\nОбновляем {len(updates)} записей в БД...")
    async with engine.begin() as conn:
        for movie_id, poster_url in updates:
            await conn.execute(
                text("UPDATE movies SET poster_url = :url WHERE id = :id"),
                {"url": poster_url, "id": movie_id},
            )

    print(f"✅ Готово! Обновлено {len(updates)} из {len(movies)} фильмов.")


if __name__ == "__main__":
    asyncio.run(main())
