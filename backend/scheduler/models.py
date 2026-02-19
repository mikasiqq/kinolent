"""
models.py (модели данных для генератора расписания кинотеатра)

Описывает сущности: фильм, зал, сеанс, расписание, конфигурацию кинотеатра.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import time, timedelta
from enum import Enum
from typing import Optional

# Метрики солвера

@dataclass
class SolverMetrics:
    """Метрики оптимальности из Column Generation солвера."""
    lp_bound: float = 0.0        # верхняя граница (LP-релаксация)
    ip_objective: float = 0.0    # значение ЦФ целочисленного решения
    gap_pct: float = 0.0         # gap оптимальности (%)



# Перечисления

class HallType(Enum):
    """Тип кинозала."""
    STANDARD_2D = "2D"
    STANDARD_3D = "3D"
    IMAX = "IMAX"
    DOLBY_ATMOS = "DOLBY_ATMOS"
    VIP = "VIP"


class AgeRating(Enum):
    """Возрастной рейтинг фильма (российская классификация)."""
    RATING_0 = "0+"
    RATING_6 = "6+"
    RATING_12 = "12+"
    RATING_16 = "16+"
    RATING_18 = "18+"


# Фильм

@dataclass
class Movie:
    """Фильм, доступный для постановки в расписание."""
    id: str
    title: str
    duration_minutes: int                   # длительность фильма (без рекламы)
    ad_block_minutes: int = 15              # трейлеры + реклама перед фильмом
    age_rating: AgeRating = AgeRating.RATING_0
    genres: list[str] = field(default_factory=list)
    popularity_score: float = 0.5           # 0..1  — популярность (для прогноза)
    release_week: int = 1                   # неделя проката (1 = премьера)
    allowed_hall_types: list[HallType] = field(
        default_factory=lambda: [HallType.STANDARD_2D]
    )
    distributor_min_shows_per_day: int = 0  # мин. кол-во сеансов/день по контракту
    distributor_max_copies: int = 99        # кол-во копий (макс. одноврем. показов)
    is_children: bool = False               # детский фильм (показ только днём)

    @property
    def total_slot_minutes(self) -> int:
        """Полная длительность «слота»: реклама + фильм."""
        return self.duration_minutes + self.ad_block_minutes


# Кинозал

@dataclass
class Hall:
    """Зал кинотеатра."""
    id: str
    name: str
    capacity: int                           # кол-во мест
    hall_type: HallType = HallType.STANDARD_2D
    cleaning_minutes: int = 15              # время уборки между сеансами
    floor: int = 1                          # этаж (для ограничения anti-crowding)
    open_time: time = field(default_factory=lambda: time(9, 0))
    close_time: time = field(default_factory=lambda: time(23, 30))

    @property
    def operating_minutes(self) -> int:
        """Продолжительность работы зала в минутах."""
        open_dt = timedelta(hours=self.open_time.hour, minutes=self.open_time.minute)
        close_dt = timedelta(hours=self.close_time.hour, minutes=self.close_time.minute)
        return int((close_dt - open_dt).total_seconds() // 60)

    def can_show(self, movie: Movie) -> bool:
        """Может ли данный зал показывать данный фильм (по типу зала)."""
        return self.hall_type in movie.allowed_hall_types


# Сеанс (показ фильма)

@dataclass
class Show:
    """Один конкретный сеанс в расписании."""
    movie: Movie
    hall: Hall
    start_minutes: int              # время начала в минутах от полуночи
    day: int = 0                    # день недели (0=пн, ..., 6=вс)
    predicted_attendance: float = 0.0  # прогноз посещаемости
    predicted_revenue: float = 0.0     # прогноз выручки

    @property
    def end_minutes(self) -> int:
        """Время окончания сеанса (без учёта уборки)."""
        return self.start_minutes + self.movie.total_slot_minutes

    @property
    def end_with_cleaning(self) -> int:
        """Время, когда зал свободен для следующего сеанса."""
        return self.end_minutes + self.hall.cleaning_minutes

    @property
    def start_time(self) -> time:
        h, m = divmod(self.start_minutes, 60)
        return time(h % 24, m)

    @property
    def end_time(self) -> time:
        h, m = divmod(self.end_minutes, 60)
        return time(h % 24, m)

    def __repr__(self) -> str:
        return (
            f"Show({self.movie.title!r}, hall={self.hall.name!r}, "
            f"{self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')}, "
            f"day={self.day}, attend={self.predicted_attendance:.0f})"
        )


# Цепочка сеансов для одного зала на один день  (= «столбец» в Column Generation)

@dataclass
class HallDaySchedule:
    """
    Допустимая цепочка сеансов для одного зала на один день.
    Это и есть «столбец» (column) в терминах Column Generation.
    """
    hall: Hall
    day: int
    shows: list[Show] = field(default_factory=list)

    @property
    def total_revenue(self) -> float:
        return sum(s.predicted_revenue for s in self.shows)

    @property
    def total_attendance(self) -> float:
        return sum(s.predicted_attendance for s in self.shows)

    @property
    def movie_ids(self) -> set[str]:
        return {s.movie.id for s in self.shows}

    def movie_show_count(self, movie_id: str) -> int:
        return sum(1 for s in self.shows if s.movie.id == movie_id)

    @property
    def last_show_end_minutes(self) -> int:
        """Время окончания последнего сеанса (мин от полуночи). 0 если пусто."""
        if not self.shows:
            return 0
        return self.shows[-1].end_minutes

    @property
    def movie_switches(self) -> int:
        """Количество смен фильма в расписании зала (≈ screen changes в статье SilverScheduler)."""
        if len(self.shows) <= 1:
            return 0
        return sum(
            1 for i in range(1, len(self.shows))
            if self.shows[i].movie.id != self.shows[i - 1].movie.id
        )

    def is_feasible(self) -> bool:
        """Проверка допустимости: сеансы не пересекаются и укладываются в рабочее время."""
        for i, show in enumerate(self.shows):
            # Зал открыт?
            hall_open = show.hall.open_time.hour * 60 + show.hall.open_time.minute
            hall_close = show.hall.close_time.hour * 60 + show.hall.close_time.minute
            if show.start_minutes < hall_open:
                return False
            if show.end_minutes > hall_close:
                return False
            # Не пересекается с предыдущим?
            if i > 0:
                prev = self.shows[i - 1]
                if show.start_minutes < prev.end_with_cleaning:
                    return False
        return True

    def __repr__(self) -> str:
        shows_str = ", ".join(
            f"{s.movie.title}@{s.start_time.strftime('%H:%M')}" for s in self.shows
        )
        return f"HallDaySchedule(hall={self.hall.name!r}, day={self.day}, [{shows_str}])"


# Полное расписание кинотеатра на неделю

@dataclass
class WeeklySchedule:
    """Итоговое расписание кинотеатра на неделю."""
    hall_day_schedules: list[HallDaySchedule] = field(default_factory=list)
    solver_metrics: Optional[SolverMetrics] = None

    @property
    def total_revenue(self) -> float:
        return sum(hds.total_revenue for hds in self.hall_day_schedules)

    @property
    def total_attendance(self) -> float:
        return sum(hds.total_attendance for hds in self.hall_day_schedules)

    @property
    def all_shows(self) -> list[Show]:
        result = []
        for hds in self.hall_day_schedules:
            result.extend(hds.shows)
        return result

    def shows_for_day(self, day: int) -> list[Show]:
        return [s for hds in self.hall_day_schedules if hds.day == day for s in hds.shows]

    def shows_for_hall(self, hall_id: str) -> list[Show]:
        return [s for hds in self.hall_day_schedules if hds.hall.id == hall_id for s in hds.shows]


# Конфигурация генератора расписания

@dataclass
class SchedulerConfig:
    """Параметры и ограничения для алгоритма составления расписания."""
    # Временные слоты
    time_slot_minutes: int = 5              # дискретность расписания (минуты)

    # Ограничения на расписание
    max_gap_between_starts: int = 30        # макс. пауза без начала нового сеанса

    # Средняя цена билета (для прогноза выручки)
    avg_ticket_price: float = 350.0         # рублей

    # Разнообразие расписания
    max_same_movie_per_hall_day: int = 2    # макс. повторений одного фильма в зале за день
    ensure_all_movies_shown: bool = True    # каждый фильм из пула должен быть показан хотя бы 1 раз/день

    # ── Штрафы из статьи SilverScheduler ──
    movie_switch_penalty: float = 100.0     # штраф Q за каждую смену фильма на экране
    stagger_penalty: float = 10.0           # штраф R за нарушение max_gap_between_starts

    # ── Anti-crowding (constraint 5 в статье) ──
    # В час-пик на одном этаже не более 1 фильма стартует в одном тайм-блоке
    crowding_block_minutes: int = 10        # длительность блока анти-краудинга
    crowding_peak_start: int = 1080         # 18:00 — начало «часа-пик» (минуты от полуночи)
    crowding_peak_end: int = 1380           # 23:00 — конец «часа-пик»

    # ── Stagger одного фильма в разных залах ──
    min_gap_same_movie_diff_halls: int = 60  # мин. разница (мин) между началами одного фильма в разных залах

    # ── Детские фильмы ──
    children_movie_latest_start: int = 1080  # 18:00 — крайнее время старта детского фильма (мин от полуночи)
    children_preferred_latest_start: int = 840  # 14:00 — «предпочтительный» крайний старт (для утренних показов)
    children_weekday_morning_boost: float = 2.5  # буст спроса на детские утренние сеансы (будни, до 14:00)

    # ── Раннее завершение (constraint 7 в статье) ──
    early_close_fraction: float = 0.3       # доля залов, где последний сеанс заканчивается до early_close_time
    early_close_time_minutes: int = 1380    # 23:00 — «мягкое» время закрытия

    # ── Праздники / каникулы (γ_v из Table 2) ──
    # Список активных типов каникул/праздников для текущей недели.
    # Возможные значения: "spring_break", "may_holiday", "ascension",
    #   "whitsun", "easter_weekend", "summer_holiday", "autumn_break",
    #   "christmas_holiday", "new_year"
    active_holidays: list[str] = field(default_factory=list)

    # ── Спортивные события (δ_NG) ──
    national_game_days: list[int] = field(default_factory=list)  # дни недели (0-6), когда трансляция

    # Column generation
    max_columns_per_hall_day: int = 500     # макс. кол-во генерируемых столбцов
    max_cg_iterations: int = 50             # макс. итераций CG

    # Дни для генерации (0=пн..6=вс)
    days: list[int] = field(default_factory=lambda: list(range(7)))
