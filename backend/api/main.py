"""
main.py — FastAPI-приложение «Кинолент».

Эндпоинты:
  GET  /api/health                 — проверка работоспособности
  POST /api/schedule/generate      — синхронная генерация расписания
  WS   /ws/generate                — генерация с прогрессом в реальном времени

Запуск:
  uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import logging
import time as time_module
import uuid
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from db.session import init_db
from db.seed import seed_if_empty
from .routes import movies_router, halls_router, schedules_db_router

from scheduler.engine import CinemaScheduler
from scheduler.models import SolverMetrics, WeeklySchedule

from .converters import config_from_request, hall_from_dto, movie_from_dto
from .schemas import (
    GenerateRequest,
    HallDayScheduleOut,
    MetricsOut,
    MovieIn,
    QualityReportOut,
    ScheduleOut,
    ShowOut,
    WsDone,
    WsError,
    WsStepUpdate,
)

# ── Логирование ──────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Приложение ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Инициализация БД и seed при старте."""
    try:
        await init_db()
        await seed_if_empty()
        logger.info("Database ready")
    except Exception as e:
        logger.warning(f"Database init failed (continuing without DB): {e}")
    yield


app = FastAPI(
    title="Кинолент API",
    description="REST + WebSocket API для генерации расписания кинотеатра "
                "методом Column Generation (SilverScheduler).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── CRUD роутеры ─────────────────────────────────────────────────────────────
app.include_router(movies_router)
app.include_router(halls_router)
app.include_router(schedules_db_router)


# ── Health-check ─────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    """Проверка работоспособности сервера."""
    return {"status": "ok", "service": "kinolent-scheduler"}


# ── Синхронная генерация (POST) ──────────────────────────────────────────────

@app.post("/api/schedule/generate", response_model=ScheduleOut)
async def generate_schedule(
    request: GenerateRequest,
    movies: list[MovieIn] | None = None,
):
    """
    Генерирует расписание кинотеатра.

    Принимает конфигурацию залов и (опционально) список фильмов.
    Если фильмы не переданы, используются демо-данные.
    """
    body = await _run_generation(request, movies)
    return body


@app.post("/api/schedule/generate-full")
async def generate_schedule_full(body: dict):
    """
    Принимает полный body: { config: GenerateRequest, movies: MovieIn[] }.
    Удобно для фронтенда, который шлёт всё одним запросом.
    """
    config_data = body.get("config", body)
    movies_data = body.get("movies", None)

    request = GenerateRequest.model_validate(config_data)
    movie_list = (
        [MovieIn.model_validate(m) for m in movies_data]
        if movies_data
        else None
    )

    result = await _run_generation(request, movie_list)
    return result


# ── WebSocket генерация с прогрессом ─────────────────────────────────────────

@app.websocket("/ws/generate")
async def ws_generate(ws: WebSocket):
    """
    WebSocket-эндпоинт для генерации с прогрессом.

    Клиент подключается и отправляет JSON:
        { "config": { ... }, "movies": [ ... ] }

    Сервер отвечает серией сообщений:
        { "type": "step", "stepIndex": 0, "label": ..., "progress": 15 }
        ...
        { "type": "done", "schedule": { ... } }
      или
        { "type": "error", "message": "..." }
    """
    await ws.accept()
    logger.info("WebSocket client connected")

    try:
        # Ожидаем конфигурацию от клиента
        data = await ws.receive_json()
        config_data = data.get("config", data)
        movies_data = data.get("movies", None)

        request = GenerateRequest.model_validate(config_data)
        movie_list = (
            [MovieIn.model_validate(m) for m in movies_data]
            if movies_data
            else None
        )

        # ── Этапы генерации ──
        steps = [
            ("Инициализация", "Подготовка данных и параметров"),
            ("Генерация столбцов", "Column Generation — поиск допустимых расписаний залов"),
            ("LP-релаксация", "Решение линейной релаксации мастер-задачи"),
            ("Целочисленное решение", "MILP — получение финального расписания"),
            ("Пост-обработка", "Расчёт прогнозов и метрик качества"),
        ]

        # Шаг 0: Инициализация
        await _ws_send_step(ws, 0, steps[0], "active", 0)
        halls_dto = [h for h in request.halls if h.enabled]
        halls = [hall_from_dto(h) for h in halls_dto]
        movie_dtos = movie_list or _get_demo_movies()
        hall_types = list({h.hall_type for h in halls})
        from scheduler.models import HallType as _HT
        all_hall_types = list(_HT)
        movies_internal = [movie_from_dto(m, all_hall_types) for m in movie_dtos if m.is_active]
        scheduler_config = config_from_request(request)
        await _ws_send_step(ws, 0, steps[0], "completed", 15)

        # Шаг 1–3: Генерация (основной алгоритм — в отдельном потоке)
        await _ws_send_step(ws, 1, steps[1], "active", 15)

        start_time = time_module.time()
        loop = asyncio.get_running_loop()

        # Прогресс-колбэк: шлёт апдейты по ws
        progress_state = {"current_step": 1}

        async def send_progress_updates():
            """Периодически обновляет прогресс, пока солвер работает."""
            fake_progress = 15.0
            step_targets = [(1, 55), (2, 75), (3, 90)]
            step_idx = 0
            while progress_state["current_step"] < 4:
                await asyncio.sleep(0.3)
                if step_idx < len(step_targets):
                    target_step, target_pct = step_targets[step_idx]
                    if fake_progress < target_pct:
                        fake_progress += (target_pct - fake_progress) * 0.15
                        s_idx = min(target_step, len(steps) - 1)
                        await _ws_send_step(ws, s_idx, steps[s_idx], "active", fake_progress)
                    else:
                        await _ws_send_step(ws, target_step, steps[target_step], "completed", fake_progress)
                        step_idx += 1
                        if step_idx < len(step_targets):
                            ns = step_targets[step_idx][0]
                            await _ws_send_step(ws, ns, steps[ns], "active", fake_progress)

        # Запускаем солвер в thread pool и прогресс параллельно
        progress_task = asyncio.create_task(send_progress_updates())

        def run_solver():
            scheduler = CinemaScheduler(
                halls=halls,
                movies=movies_internal,
                config=scheduler_config,
            )
            return scheduler.generate(), scheduler

        schedule, scheduler = await loop.run_in_executor(None, run_solver)

        progress_state["current_step"] = 4
        await asyncio.sleep(0.1)
        progress_task.cancel()

        elapsed_ms = (time_module.time() - start_time) * 1000

        # Шаги 1-3 завершены
        for i in range(1, 4):
            await _ws_send_step(ws, i, steps[i], "completed", 90)

        # Шаг 4: Пост-обработка
        await _ws_send_step(ws, 4, steps[4], "active", 90)
        quality = scheduler.quality_report(schedule)
        result = _build_schedule_out(
            schedule, request, movie_dtos, quality, elapsed_ms,
        )
        await _ws_send_step(ws, 4, steps[4], "completed", 100)

        # Отправляем результат
        done_msg = WsDone(schedule=result)
        await ws.send_json(done_msg.model_dump(by_alias=True))
        logger.info(
            f"Schedule generated: {result.total_shows} shows, "
            f"{elapsed_ms:.0f}ms"
        )

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.exception("WebSocket generation error")
        try:
            err_msg = WsError(message=str(e))
            await ws.send_json(err_msg.model_dump(by_alias=True))
        except Exception:
            pass


# ── Внутренние функции ───────────────────────────────────────────────────────

async def _ws_send_step(
    ws: WebSocket,
    index: int,
    step: tuple[str, str],
    status: str,
    progress: float,
):
    msg = WsStepUpdate(
        step_index=index,
        label=step[0],
        description=step[1],
        status=status,
        progress=min(progress, 100),
    )
    await ws.send_json(msg.model_dump(by_alias=True))


async def _run_generation(
    request: GenerateRequest,
    movies: list[MovieIn] | None,
) -> ScheduleOut:
    """Синхронная генерация (для POST endpoint)."""
    halls_dto = [h for h in request.halls if h.enabled]
    halls = [hall_from_dto(h) for h in halls_dto]
    movie_dtos = movies or _get_demo_movies()
    from scheduler.models import HallType as _HT
    all_hall_types = list(_HT)
    movies_internal = [movie_from_dto(m, all_hall_types) for m in movie_dtos if m.is_active]
    scheduler_config = config_from_request(request)

    start = time_module.time()
    scheduler = CinemaScheduler(
        halls=halls, movies=movies_internal, config=scheduler_config,
    )

    loop = asyncio.get_running_loop()
    schedule = await loop.run_in_executor(None, scheduler.generate)
    elapsed_ms = (time_module.time() - start) * 1000

    quality = scheduler.quality_report(schedule)
    return _build_schedule_out(schedule, request, movie_dtos, quality, elapsed_ms)


def _build_schedule_out(
    schedule: WeeklySchedule,
    request: GenerateRequest,
    movie_dtos: list[MovieIn],
    quality: dict,
    elapsed_ms: float,
) -> ScheduleOut:
    """Конвертирует WeeklySchedule → ScheduleOut (Pydantic)."""
    movie_meta = {m.id: m for m in movie_dtos}
    metrics = schedule.solver_metrics or SolverMetrics()

    hall_schedules: list[HallDayScheduleOut] = []
    show_counter = 0

    for hds in schedule.hall_day_schedules:
        shows_out: list[ShowOut] = []
        for show in hds.shows:
            show_counter += 1
            meta = movie_meta.get(show.movie.id)
            shows_out.append(ShowOut(
                id=f"s{show_counter}",
                movie_id=show.movie.id,
                movie_title=show.movie.title,
                movie_duration=show.movie.duration_minutes,
                ad_block_minutes=show.movie.ad_block_minutes,
                hall_id=hds.hall.id,
                hall_name=hds.hall.name,
                day=hds.day,
                start_minutes=show.start_minutes,
                end_minutes=show.end_minutes,
                predicted_attendance=round(show.predicted_attendance),
                predicted_revenue=round(show.predicted_revenue, 2),
                genre=show.movie.genres[0] if show.movie.genres else "drama",
                age_rating=show.movie.age_rating.value,
                poster_url=meta.poster_url if meta else None,
            ))

        hall_schedules.append(HallDayScheduleOut(
            hall_id=hds.hall.id,
            hall_name=hds.hall.name,
            day=hds.day,
            shows=shows_out,
            total_revenue=round(hds.total_revenue, 2),
            total_attendance=round(hds.total_attendance),
        ))

    quality_report = QualityReportOut(
        total_shows=quality["total_shows"],
        total_revenue=quality["total_revenue"],
        total_attendance=quality["total_attendance"],
        total_movie_switches=quality["total_movie_switches"],
        stagger_violations=quality["stagger_violations"],
        crowding_violations=quality["crowding_violations"],
        same_movie_stagger_violations=quality["same_movie_stagger_violations"],
        early_closure_violations=quality["early_closure_violations"],
        optimality_gap_pct=quality["optimality_gap_pct"],
    )

    # Защита от inf/nan (не сериализуются в JSON)
    import math
    gap = metrics.gap_pct if math.isfinite(metrics.gap_pct) else 0.0
    lp_b = metrics.lp_bound if math.isfinite(metrics.lp_bound) else 0.0
    ip_o = metrics.ip_objective if math.isfinite(metrics.ip_objective) else 0.0
    q_gap = quality["optimality_gap_pct"]
    q_gap = q_gap if math.isfinite(q_gap) else 0.0
    quality_report.optimality_gap_pct = q_gap

    return ScheduleOut(
        id=str(uuid.uuid4()),
        name=request.schedule_name,
        created_at=datetime.now().isoformat(),
        days=request.days,
        hall_schedules=hall_schedules,
        total_revenue=round(schedule.total_revenue, 2),
        total_attendance=round(schedule.total_attendance),
        total_shows=len(schedule.all_shows),
        metrics=MetricsOut(
            lp_bound=round(lp_b, 2),
            ip_objective=round(ip_o, 2),
            gap_pct=round(gap, 2),
            generation_time_ms=round(elapsed_ms, 1),
            columns_generated=0,
        ),
        quality_report=quality_report,
    )


def _get_demo_movies() -> list[MovieIn]:
    """Демо-фильмы, если фронтенд не прислал список."""
    return [
        MovieIn(id="1", title="Дюна: Часть вторая", duration=166, ageRating="12+",
                genre="sci-fi", popularity=9, minShowsPerDay=0, maxShowsPerDay=5, isActive=True),
        MovieIn(id="2", title="Оппенгеймер", duration=180, ageRating="16+",
                genre="drama", popularity=10, minShowsPerDay=0, maxShowsPerDay=4, isActive=True),
        MovieIn(id="3", title="Головоломка 2", duration=100, ageRating="6+",
                genre="animation", popularity=8, minShowsPerDay=0, maxShowsPerDay=6, isActive=True),
        MovieIn(id="4", title="Чужой: Ромул", duration=119, ageRating="18+",
                genre="horror", popularity=7, minShowsPerDay=0, maxShowsPerDay=3, isActive=True),
        MovieIn(id="5", title="Гладиатор 2", duration=148, ageRating="16+",
                genre="action", popularity=8, minShowsPerDay=0, maxShowsPerDay=5, isActive=True),
        MovieIn(id="6", title="Интерстеллар: Возвращение", duration=165, ageRating="12+",
                genre="sci-fi", popularity=9, minShowsPerDay=0, maxShowsPerDay=4, isActive=True),
        MovieIn(id="7", title="Тихое место: День первый", duration=100, ageRating="16+",
                genre="horror", popularity=6, minShowsPerDay=0, maxShowsPerDay=3, isActive=True),
        MovieIn(id="8", title="Гарри Поттер: Новое поколение", duration=140, ageRating="12+",
                genre="fantasy", popularity=9, minShowsPerDay=0, maxShowsPerDay=5, isActive=True),
    ]
