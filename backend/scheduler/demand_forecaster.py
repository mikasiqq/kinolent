"""
demand_forecaster.py (модуль прогнозирования посещаемости сеансов)

Реализует модель прогнозирования SilverScheduler:
  attendance(movie, hall, day, time) → кол-во зрителей

Полная формула (18) из статьи SilverScheduler:
  A_jt = exp(θ_j + λ_j·AGE
             + Σβ_h·I_h + Σω_d·I_d + Σγ_v·I_v
             + δ_SATNIGHT·SATNIGHT_t + δ_SUNPM·SUNPM_t
             + δ_NG·NG_t + δ_DTEMP·DTEMP_t + δ_DPRECIP·DPRECIP_t + ε_jt)

Реализованные компоненты:
  - θ_j, λ_j — популярность фильма и неделю проката
  - β_h      — часовые коэффициенты из Table 2
  - ω_d      — день недели из Table 2
  - γ_v      — праздники/каникулы (9 типов из Table 2)
  - δ_SATNIGHT — штраф поздней субботы (23:00-01:00)
  - δ_SUNPM    — бонус воскресного дня (14:00-18:00)
  - δ_NG       — штраф за крупные спортивные трансляции
  - σ²/2       — коррекция смещения OLS → exp (eq. 20)
  - ограничение детских фильмов по времени
  - вместимость зала (attendance ≤ capacity)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from .models import Hall, Movie, SchedulerConfig, Show



# Коэффициенты модели прогноза (из Table 2 статьи SilverScheduler)

# Коэффициенты дня недели ω_d (base = суббота = 1.0)
# Из Table 2: MON=-0.590, TUE=-0.380, WED=-0.431, THU=-0.291,
#              FRI=-0.165, SAT=base, SUN=-0.015
DAY_FACTORS: dict[int, float] = {
    0: math.exp(-0.590),   # понедельник ≈ 0.554
    1: math.exp(-0.380),   # вторник    ≈ 0.684
    2: math.exp(-0.431),   # среда      ≈ 0.650
    3: math.exp(-0.291),   # четверг    ≈ 0.748
    4: math.exp(-0.165),   # пятница    ≈ 0.848
    5: 1.00,               # суббота    = 1.000 (base)
    6: math.exp(-0.015),   # воскресенье ≈ 0.985
}

# Коэффициенты времени суток β_h (base = 20:00 = 1.0)
# Из Table 2: 10am=-2.011, 11am=-1.712, 12pm=-1.885, 1pm=-1.334,
#   2pm=-1.063, 3pm=-1.066, 4pm=-1.164, 5pm=-1.063, 6pm=-0.768,
#   7pm=-0.349, 8pm=base, 9pm=-0.237, 10pm=-0.491
HOUR_FACTORS: dict[int, float] = {
    9:  math.exp(-2.200),   # 09:00 ≈ 0.111 (экстраполяция)
    10: math.exp(-2.011),   # 10:00 ≈ 0.134
    11: math.exp(-1.712),   # 11:00 ≈ 0.181
    12: math.exp(-1.885),   # 12:00 ≈ 0.152
    13: math.exp(-1.334),   # 13:00 ≈ 0.264
    14: math.exp(-1.063),   # 14:00 ≈ 0.345
    15: math.exp(-1.066),   # 15:00 ≈ 0.344
    16: math.exp(-1.164),   # 16:00 ≈ 0.312
    17: math.exp(-1.063),   # 17:00 ≈ 0.345
    18: math.exp(-0.768),   # 18:00 ≈ 0.464
    19: math.exp(-0.349),   # 19:00 ≈ 0.706
    20: 1.000,              # 20:00 = 1.000 (base/пик)
    21: math.exp(-0.237),   # 21:00 ≈ 0.789
    22: math.exp(-0.491),   # 22:00 ≈ 0.612
    23: math.exp(-1.033),   # 23:00 ≈ 0.356
}

# δ_SUNPM — бонус воскресного дня (14:00-18:00): +0.512
SUNDAY_AFTERNOON_BONUS: float = math.exp(0.512)  # ≈ 1.668

# δ_SATNIGHT — штраф поздней субботы (23:00+): -1.033
SATURDAY_NIGHT_FACTOR: float = math.exp(-1.033)  # ≈ 0.356

# δ_NG — штраф за национальные спортивные трансляции: -1.123
NATIONAL_GAME_FACTOR: float = math.exp(-1.123)  # ≈ 0.325

# γ_v — коэффициенты праздников/каникул из Table 2 статьи
# Значения: exp(γ_v) для каждого типа каникул
HOLIDAY_FACTORS: dict[str, float] = {
    "spring_break":      math.exp(0.589),   # весенние каникулы  ≈ 1.802
    "may_holiday":       math.exp(0.365),   # майские праздники  ≈ 1.441
    "ascension":         math.exp(0.891),   # Вознесение         ≈ 2.438
    "whitsun":           math.exp(0.850),   # Троица              ≈ 2.340
    "easter_weekend":    math.exp(0.452),   # Пасхальные выходные ≈ 1.571
    "summer_holiday":    math.exp(0.142),   # летние каникулы     ≈ 1.153
    "autumn_break":      math.exp(0.616),   # осенние каникулы    ≈ 1.851
    "christmas_holiday": math.exp(0.723),   # рождественские      ≈ 2.061
    "new_year":          math.exp(0.723),   # новогодние (≈ рождественские)
}

# σ² / 2 — коррекция смещения log-модели (eq. 20 статьи).
# σ² оценена из данных De Munt; используем типичное значение ≈ 0.8
_LOG_BIAS_CORRECTION: float = math.exp(0.8 / 2)  # ≈ 1.492


def _time_factor(start_hour: float) -> float:
    """
    Возвращает часовой множитель β_h из Table 2 статьи.
    Интерполирует между ближайшими целыми часами.
    """
    h = int(start_hour)
    frac = start_hour - h

    v1 = HOUR_FACTORS.get(h, HOUR_FACTORS.get(min(HOUR_FACTORS.keys()), 0.11))
    v2 = HOUR_FACTORS.get(h + 1, HOUR_FACTORS.get(max(HOUR_FACTORS.keys()), 0.36))

    return v1 + frac * (v2 - v1)


def _release_decay(week: int) -> float:
    """
    Затухание интереса к фильму по неделям проката (λ_j · AGE_jt).
    Неделя 1 (премьера) = 1.0, далее экспоненциальный спад.
    Из статьи: λ ≈ -0.053 для сильных фильмов, до -0.25 для слабых.
    Используем среднее: -0.15/неделю.
    """
    decay_rate = 0.15
    return math.exp(-decay_rate * (week - 1))



# Класс прогнозирования

@dataclass
class DemandForecaster:
    """
    Прогнозирует посещаемость и выручку для потенциального сеанса.

    Формула (адаптация eq. 18 / eq. 20 из SilverScheduler):
        base_demand = capacity × fill_rate × popularity × release_decay
                      × day_factor × time_factor × holiday_factor
                      × special_bonuses × log_bias_correction
        attendance  = min(base_demand, capacity)
        revenue     = attendance × avg_ticket_price
    """
    config: SchedulerConfig
    base_fill_rate: float = 0.85

    def predict_attendance(
        self,
        movie: Movie,
        hall: Hall,
        day: int,
        start_minutes: int,
    ) -> float:
        """Прогноз числа зрителей на сеанс."""
        start_hour = start_minutes / 60.0

        # Базовая формула
        demand = (
            hall.capacity
            * self.base_fill_rate
            * movie.popularity_score
            * _release_decay(movie.release_week)
            * DAY_FACTORS.get(day, 0.65)
            * _time_factor(start_hour)
        )

        # δ_SUNPM: бонус воскресного дня (14:00-18:00) из Table 2
        if day == 6 and 14.0 <= start_hour < 18.0:
            demand *= SUNDAY_AFTERNOON_BONUS

        # δ_SATNIGHT: штраф поздней субботы (23:00+) из Table 2
        if day == 5 and start_hour >= 23.0:
            demand *= SATURDAY_NIGHT_FACTOR

        # γ_v: праздники/каникулы — мультипликативный бонус (все активные суммируются)
        for holiday in self.config.active_holidays:
            factor = HOLIDAY_FACTORS.get(holiday, 1.0)
            demand *= factor

        # δ_NG: национальные спортивные трансляции — падение посещаемости
        if day in self.config.national_game_days:
            demand *= NATIONAL_GAME_FACTOR

        # σ²/2: коррекция смещения OLS → exp (eq. 20 статьи)
        demand *= _LOG_BIAS_CORRECTION

        # Детские фильмы: нулевой спрос в вечернее время
        if movie.is_children and start_minutes >= self.config.children_movie_latest_start:
            demand = 0.0

        # Детские фильмы: буст утренних/дневных сеансов на будни (9:00-14:00)
        # Обоснование: детская аудитория (каникулы, подвоз) преимущественно
        # приходит с утра; hourly factors из Table 2 не учитывают это.
        if (movie.is_children
                and day not in (5, 6)
                and 9.0 <= start_hour < 14.0):
            demand *= self.config.children_weekday_morning_boost

        # Детские фильмы: бонус в выходные днём (10:00-16:00)
        if movie.is_children and day in (5, 6) and 10.0 <= start_hour < 16.0:
            demand *= 1.3

        return min(demand, hall.capacity)

    def predict_revenue(
        self,
        movie: Movie,
        hall: Hall,
        day: int,
        start_minutes: int,
    ) -> float:
        """Прогноз выручки от сеанса."""
        attendance = self.predict_attendance(movie, hall, day, start_minutes)
        return attendance * self.config.avg_ticket_price

    def predict_for_show(self, show: Show) -> Show:
        """Заполнить прогнозные поля объекта Show (посещаемость и выручка)."""
        show.predicted_attendance = self.predict_attendance(
            show.movie, show.hall, show.day, show.start_minutes
        )
        show.predicted_revenue = self.predict_revenue(
            show.movie, show.hall, show.day, show.start_minutes
        )
        return show
