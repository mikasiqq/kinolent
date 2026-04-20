"""
solver.py (column Generation solver для задачи составления расписания кинотеатра)

Реализует полный алгоритм из статьи SilverScheduler:

    Шаг 0: Инициализация — жадные + DFS столбцы.

    Шаг 1: Master Problem (LP-релаксация + Лагранжева релаксация)
            LP через scipy.linprog → dual prices + LP bound.
            Лагранжева релаксация + субградиентная оптимизация → LR bound.

    Шаг 2: Pricing Sub-problem
            Для каждого (зала, дня) генерируем новые столбцы с отрицательной
            приведённой стоимостью.

    Шаг 3: IP solve (PuLP MILP)
            Решаем целочисленную задачу из набора сгенерированных столбцов.

    Post-processing:
       - Staggering (constraint 6) — переменные y_l + штраф R в ЦФ
       - Early closure (constraint 7) — доля r залов завершает рано
       - Same-movie stagger across halls
       - Diversity bonus — мягкий стимул для показа всех фильмов

    Нижняя граница и gap:
       LP / Lagrangian lower bound + IP obj → оценка оптимальности.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from scipy.optimize import linprog

from .column_generator import ColumnGenerator
from .models import (
    Hall,
    HallDaySchedule,
    Movie,
    SchedulerConfig,
    SolverMetrics,
    WeeklySchedule,
)

logger = logging.getLogger(__name__)

import pulp


# Вспомогательные типы

@dataclass
class _ColumnGenerationState:
    """Внутреннее состояние итерации Column Generation."""
    columns: list[HallDaySchedule]          # все сгенерированные столбцы
    obj_value: float = 0.0                  # значение ЦФ (IP решения)
    lp_bound: float = 0.0                   # LP нижняя граница (CG bound)
    lagrangian_bound: float = 0.0           # Лагранжева нижняя граница
    dual_prices_hall_day: dict[tuple[str, int], float] = field(default_factory=dict)
    dual_prices_movie: dict[str, float] = field(default_factory=dict)
    solution_indices: list[int] = field(default_factory=list)
    _is_greedy_fallback: bool = False


# Солвер

@dataclass
class ScheduleSolver:
    """
    Column Generation солвер для задачи расписания кинотеатра.

    Полная формулировка MSP (eq. 8-14 из статьи SilverScheduler):

        max  Σ_j  (c_j − Q·switches_j) · x_j  − R · Σ_l y_l

        s.t. Σ_j  a_{s,d,j} · x_j  = 1               ∀ (hall s, day d)   (10)
             Σ_j  b_{m,j} · x_j    ≤ copies_m         ∀ movie m           (9)
             Σ  starts_in_interval + y_l ≥ 1           ∀ interval l        (12)
             Σ  h^s_p · x_j        ≥ r · |S|           early closure      (13)
             x_j ∈ {0,1}, y_l ∈ {0,1}                                     (14)

    Лагранжева релаксация:
        Ослабляем (9)-(13) с множителями λ, μ, σ, ω.
        Субградиентная оптимизация для нахождения лучших множителей.
    """
    halls: list[Hall]
    movies: list[Movie]
    config: SchedulerConfig
    column_gen: ColumnGenerator

    def solve(self) -> WeeklySchedule:
        """Основной метод: запускает Column Generation и возвращает расписание."""
        logger.info("=== Column Generation Solver START ===")
        num_hall_days = len(self.halls) * len(self.config.days)
        logger.info(f"Scale: {len(self.halls)} halls × {len(self.config.days)} days = {num_hall_days} (hall,day) pairs")

        # Динамически масштабируем параметры под размер задачи
        if num_hall_days > 50:
            self.config.max_columns_per_hall_day = min(self.config.max_columns_per_hall_day, 50)
            self.config.max_cg_iterations = min(self.config.max_cg_iterations, 5)
            logger.info(f"Large instance: capped columns/hd={self.config.max_columns_per_hall_day}, CG iters={self.config.max_cg_iterations}")
        elif num_hall_days > 20:
            self.config.max_columns_per_hall_day = min(self.config.max_columns_per_hall_day, 150)
            self.config.max_cg_iterations = min(self.config.max_cg_iterations, 15)

        # Авто-расчёт max_shows_per_movie_per_day для разнообразия
        if self.config.max_shows_per_movie_per_day <= 0 and len(self.movies) > 0:
            # Каждый фильм может занять не более ceil(total_daily_shows / movies) * 2
            # или ceil(halls/2) — что меньше
            avg_shows_per_hall = 4
            total_daily_shows = len(self.halls) * avg_shows_per_hall
            fair_share = max(3, math.ceil(total_daily_shows / len(self.movies)) + 2)
            # Не более 30% всех слотов для одного фильма, но не меньше 4
            max_cap = max(4, math.ceil(total_daily_shows * 0.30))
            # Также не более кол-ва залов
            self.config.max_shows_per_movie_per_day = min(fair_share, max_cap, len(self.halls))
            logger.info(f"Auto max_shows/movie/day = {self.config.max_shows_per_movie_per_day} "
                        f"(halls={len(self.halls)}, movies={len(self.movies)}, total_slots~{total_daily_shows})")

        # ── Шаг 0: Начальный набор столбцов ──
        state = _ColumnGenerationState(columns=[])
        self._generate_initial_columns(state)
        logger.info(f"Initial columns: {len(state.columns)}")

        # ── Шаги 1–2: Итерации Column Generation ──
        best_lb = -float("inf")
        try:
            for iteration in range(self.config.max_cg_iterations):
                # Шаг 1: Решить Master Problem (LP + Лагранжева релаксация)
                feasible = self._solve_master_problem(state)
                if not feasible:
                    logger.warning(f"CG iter {iteration}: master infeasible, stopping")
                    break

                # Обновить лучшую нижнюю границу
                current_lb = max(state.lp_bound, state.lagrangian_bound)
                if current_lb > best_lb:
                    best_lb = current_lb

                logger.info(
                    f"CG iter {iteration}: LP obj = {state.obj_value:.0f}, "
                    f"LB = {best_lb:.0f}, columns = {len(state.columns)}"
                )

                # Шаг 2: Pricing — генерировать новые столбцы
                new_cols = self._pricing_step(state)
                if not new_cols:
                    logger.info(f"CG converged at iteration {iteration}")
                    break

                state.columns.extend(new_cols)
                logger.info(f"  Added {len(new_cols)} new columns")
        except Exception as e:
            logger.warning(f"CG iteration failed: {e}, proceeding with current columns")

        state.lagrangian_bound = max(best_lb, state.lagrangian_bound)

        # ── Шаг 3: Решить IP (PuLP MILP) ──
        self._solve_ip(state)

        # ── Вычислить gap оптимальности ──
        # LP bound — это верхняя граница (LP-релаксация ≥ IP оптимума),
        # Lagrangian bound тоже верхняя, но часто завышена из-за
        # недостаточной сходимости субградиентов.
        # Берём min(LP, LR) как самую точную верхнюю границу.
        lp_ub = state.lp_bound
        lr_ub = state.lagrangian_bound if state.lagrangian_bound > 0 else float("inf")
        best_ub = min(lp_ub, lr_ub) if lr_ub < float("inf") else lp_ub
        ip_obj = state.obj_value
        if state._is_greedy_fallback:
            # Greedy не учитывает ограничения LP — gap бессмысленен
            gap = -1.0  # индикатор «greedy fallback»
        elif best_ub > 0 and ip_obj > 0:
            gap = (best_ub - ip_obj) / best_ub * 100
            gap = max(gap, 0.0)
        else:
            gap = float("inf")
        logger.info(
            f"IP obj = {ip_obj:.0f}, LP bound = {lp_ub:.0f}, "
            f"LR bound = {lr_ub:.0f}, Best UB = {best_ub:.0f}, Gap = {gap:.2f}%"
        )

        # ── Собрать итоговое расписание ──
        schedule = WeeklySchedule(
            hall_day_schedules=[state.columns[i] for i in state.solution_indices]
        )

        # Сохранить метрики оптимальности
        schedule.solver_metrics = SolverMetrics(
            lp_bound=best_ub,
            ip_objective=ip_obj,
            gap_pct=gap,
            columns_generated=len(state.columns),
            is_greedy_fallback=state._is_greedy_fallback,
        )

        logger.info(
            f"=== Solver DONE: revenue={schedule.total_revenue:.0f}, "
            f"attendance={schedule.total_attendance:.0f}, "
            f"shows={len(schedule.all_shows)} ==="
        )
        return schedule

    # Шаг 0: Начальные столбцы    

    def _generate_initial_columns(self, state: _ColumnGenerationState) -> None:
        """Генерирует стартовый набор столбцов жадной эвристикой + ограниченный DFS."""
        max_same = self.config.max_same_movie_per_hall_day
        for hall in self.halls:
            for day in self.config.days:
                # Разнообразные жадные столбцы — по одному на каждый совместимый фильм
                compatible = [m for m in self.movies if hall.can_show(m)]
                for movie in compatible:
                    greedy = self.column_gen.generate_greedy_column(
                        hall, day,
                        preferred_movie=movie,
                        max_same_movie=max_same,
                    )
                    if greedy.shows:
                        state.columns.append(greedy)

                # Общий жадный столбец (без предпочтения)
                greedy = self.column_gen.generate_greedy_column(
                    hall, day, max_same_movie=max_same,
                )
                if greedy.shows:
                    state.columns.append(greedy)

                # Столбцы-исключения: для каждого из top-3 популярных фильмов
                # генерируем столбец БЕЗ этого фильма, чтобы MILP мог снизить
                # доминирование самых популярных
                top_movies = sorted(compatible, key=lambda m: m.popularity_score, reverse=True)[:3]
                for excl_movie in top_movies:
                    excl_greedy = self.column_gen.generate_greedy_column(
                        hall, day, max_same_movie=max_same,
                        excluded_movie_ids={excl_movie.id},
                    )
                    if excl_greedy.shows:
                        state.columns.append(excl_greedy)

                # DFS-столбцы (ограниченное кол-во)
                dfs_cols = self.column_gen.generate_columns(hall, day)
                state.columns.extend(dfs_cols)

    # Шаг 1: Master Problem — LP + Лагранжева релаксация
    
    def _solve_master_problem(self, state: _ColumnGenerationState) -> bool:
        """
        Решает Master Problem двумя способами:
          1. LP-релаксация через scipy.linprog → dual prices + LP bound
          2. Лагранжева релаксация + субградиентная оптимизация → LR bound

        Заполняет state: dual_prices, lp_bound, lagrangian_bound.
        """
        lp_ok = self._solve_lp_relaxation(state)
        if not lp_ok:
            return False
        try:
            self._lagrangian_relaxation(state)
        except Exception as e:
            logger.warning(f"Lagrangian relaxation failed: {e}")
        return True
  
    # LP-релаксация (Restricted Master Problem)

    def _solve_lp_relaxation(self, state: _ColumnGenerationState) -> bool:
        """
        Решает LP-релаксацию Master Problem включая:
         - Покрытие (hall, day) = 1                              (eq. 10)
         - Копии: movie copies ≤ max                             (eq. 9)
         - Min-shows / ensure_all_movies
         - Staggering: переменные y_l с штрафом R в ЦФ           (eq. 12)
         - Early closure: доля залов с ранним завершением ≥ r    (eq. 13)

        Возвращает True если разрешимо.
        """
        num_columns = len(state.columns)
        if num_columns == 0:
            return False

        Q = self.config.movie_switch_penalty
        R = self.config.stagger_penalty

        # ── Индексация (hall_id, day) ──
        hall_day_pairs = self._compute_hall_day_pairs()
        num_hall_days = len(hall_day_pairs)
        hall_day_index = {hd: i for i, hd in enumerate(hall_day_pairs)}

        # ── Индексация movie_id ──
        movie_ids = [m.id for m in self.movies]
        movie_map = {m.id: m for m in self.movies}

        # ── Staggering intervals ──
        stagger_intervals = self._compute_stagger_intervals()
        num_stagger = len(stagger_intervals)

        # ── Переменные: x_0..x_{num_columns-1}, y_0..y_{num_stagger-1} ──
        num_variables = num_columns + num_stagger

        # ── Целевая функция (linprog минимизирует → инвертируем) ──
        cost_vector = np.zeros(num_variables)
        for j, col in enumerate(state.columns):
            cost_vector[j] = -(col.total_revenue - Q * col.movie_switches)
        # Штраф R за каждое нарушение staggering
        for l_idx in range(num_stagger):
            cost_vector[num_columns + l_idx] = R  # +R в минимизации = −R в максимизации

        # ── A_eq: покрытие (hall, day) ──
        A_eq = np.zeros((num_hall_days, num_variables))
        for j, col in enumerate(state.columns):
            hd = (col.hall.id, col.day)
            if hd in hall_day_index:
                A_eq[hall_day_index[hd], j] = 1.0
        b_eq = np.ones(num_hall_days)

        # ── A_ub rows ──
        inequality_rows: list[np.ndarray] = []
        inequality_rhs: list[float] = []

        # 1. Ограничения копий
        day_movie_pairs = [(day, mid) for day in self.config.days for mid in movie_ids]
        for day, mid in day_movie_pairs:
            row = np.zeros(num_variables)
            for j, col in enumerate(state.columns):
                if col.day == day and mid in col.movie_ids:
                    row[j] = 1.0
            inequality_rows.append(row)
            inequality_rhs.append(movie_map[mid].distributor_max_copies)

        # 2. Min-shows: -Σ count * x_j ≤ -required
        # В LP не форсируем ensure_all_movies_shown — только контрактные минимумы.
        # ensure_all форсируется в MILP (целочисленном решении).
        for day in self.config.days:
            for mid in movie_ids:
                movie = movie_map[mid]
                required = movie.distributor_min_shows_per_day  # только контрактное
                if required > 0:
                    row = np.zeros(num_variables)
                    has_movie = False
                    for j, col in enumerate(state.columns):
                        if col.day == day:
                            count = col.movie_show_count(mid)
                            if count > 0:
                                has_movie = True
                            row[j] = -count
                    if has_movie:
                        inequality_rows.append(row)
                        inequality_rhs.append(-required)

        # 3. Staggering (eq. 12): -Σ starts * x_j - y_l ≤ -1
        for l_idx, (day, t_start, t_end) in enumerate(stagger_intervals):
            row = np.zeros(num_variables)
            for j, col in enumerate(state.columns):
                if col.day != day:
                    continue
                starts_in = sum(
                    1 for s in col.shows if t_start <= s.start_minutes < t_end
                )
                row[j] = -starts_in
            row[num_columns + l_idx] = -1.0  # y_l
            inequality_rows.append(row)
            inequality_rhs.append(-1.0)

        # 4. Early closure (eq. 13): -Σ h_j · x_j ≤ -r·|S|
        r_frac = self.config.early_close_fraction
        ec_time = self.config.early_close_time_minutes
        for day in self.config.days:
            row = np.zeros(num_variables)
            n_halls_day = 0
            for hall in self.halls:
                hd = (hall.id, day)
                if hd not in hall_day_index:
                    continue
                n_halls_day += 1
                for j, col in enumerate(state.columns):
                    if (col.hall.id, col.day) == hd:
                        if col.last_show_end_minutes <= ec_time:
                            row[j] = -1.0
            if n_halls_day > 0:
                inequality_rows.append(row)
                inequality_rhs.append(-r_frac * n_halls_day)

        # ── Собрать A_ub, b_ub ──
        if inequality_rows:
            A_ub = np.array(inequality_rows)
            b_ub = np.array(inequality_rhs)
        else:
            A_ub = np.zeros((1, num_variables))
            b_ub = np.zeros(1)

        # ── Границы: 0 ≤ x_j ≤ 1, 0 ≤ y_l ≤ 1 ──
        bounds = [(0, 1) for _ in range(num_variables)]

        # ── Решить LP ──
        result = linprog(
            cost_vector, A_ub=A_ub, b_ub=b_ub, A_eq=A_eq, b_eq=b_eq,
            bounds=bounds, method="highs",
        )

        if not result.success:
            result = linprog(
                cost_vector,
                A_ub=np.vstack([A_ub, A_eq]),
                b_ub=np.concatenate([b_ub, b_eq]),
                bounds=bounds, method="highs",
            )
            if not result.success:
                return False

        state.lp_bound = -result.fun
        state.obj_value = -result.fun

        # ── Извлечь настоящие dual prices из HiGHS ──
        x = result.x[:num_columns] if result.x is not None and len(result.x) >= num_columns else np.zeros(num_columns)

        # Equality constraints: покрытие (hall, day)  →  eqlin marginals
        # HiGHS возвращает marginals со знаком для min-задачи.
        # Для max-задачи (мы инвертировали ЦФ): dual = −marginal.
        state.dual_prices_hall_day = {}
        try:
            if hasattr(result, 'eqlin') and hasattr(result.eqlin, 'marginals') and len(result.eqlin.marginals) >= num_hall_days:
                eq_duals = result.eqlin.marginals
                for hd_pair in hall_day_pairs:
                    idx = hall_day_index[hd_pair]
                    state.dual_prices_hall_day[hd_pair] = -float(eq_duals[idx])
            else:
                for hd_pair in hall_day_pairs:
                    hd_idx = hall_day_index[hd_pair]
                    total_w = 0.0
                    total_r = 0.0
                    for j in range(num_columns):
                        if A_eq[hd_idx, j] > 0 and x[j] > 1e-6:
                            total_w += x[j]
                            total_r += x[j] * (state.columns[j].total_revenue
                                               - Q * state.columns[j].movie_switches)
                    state.dual_prices_hall_day[hd_pair] = total_r / max(total_w, 1e-9)
        except Exception as e:
            logger.warning(f"Failed to extract hall_day dual prices: {e}")
            for hd_pair in hall_day_pairs:
                state.dual_prices_hall_day[hd_pair] = 0.0

        # Inequality constraints: copies, min-shows, stagger, early closure
        state.dual_prices_movie = {}
        try:
            if hasattr(result, 'ineqlin') and hasattr(result.ineqlin, 'marginals') and len(result.ineqlin.marginals) > 0:
                ineq_duals = result.ineqlin.marginals
                num_day_movies = len(day_movie_pairs)
                movie_dual_sum: dict[str, float] = {mid: 0.0 for mid in movie_ids}
                for i, (day, mid) in enumerate(day_movie_pairs):
                    if i < len(ineq_duals):
                        movie_dual_sum[mid] += float(ineq_duals[i])
                for mid in movie_ids:
                    state.dual_prices_movie[mid] = movie_dual_sum[mid]
            else:
                for mid in movie_ids:
                    state.dual_prices_movie[mid] = 0.0
        except Exception as e:
            logger.warning(f"Failed to extract movie dual prices: {e}")
            for mid in movie_ids:
                state.dual_prices_movie[mid] = 0.0

        state.solution_indices = [j for j in range(num_columns) if x[j] > 0.5]

        return True

    # Лагранжева релаксация + субградиентная оптимизация (Шаг 1 статьи)    

    def _lagrangian_relaxation(self, state: _ColumnGenerationState) -> None:
        """
        Лагранжева релаксация MSP (секция 3.2 статьи SilverScheduler).

        Ослабляем ограничения (9)-(13) лагранжевым образом:
         - λ_dm ≥ 0 для ограничений на копии (9)
         - μ_hd   для покрытия (10) — свободный знак
         - σ_l  ≥ 0 для staggering (12)
         - ω_d  ≥ 0 для early closure (13)

        Лагранжева подзадача:
            max Σ c̄_j x_j  − (R − σ_l) y_l  + const
            x_j ∈ {0,1}, y_l ∈ {0,1}
            → решается тривиально: x_j = 1 если c̄_j > 0

        Субградиентная оптимизация для нахождения лучших множителей.
        """
        num_columns = len(state.columns)
        if num_columns == 0:
            return

        Q = self.config.movie_switch_penalty
        R = self.config.stagger_penalty

        # Индексация
        hall_day_pairs = self._compute_hall_day_pairs()
        hall_day_index = {hd: i for i, hd in enumerate(hall_day_pairs)}
        num_hall_days = len(hall_day_pairs)

        movie_ids = [m.id for m in self.movies]
        movie_map = {m.id: m for m in self.movies}
        day_movie_pairs = [(day, mid) for day in self.config.days for mid in movie_ids]
        num_day_movies = len(day_movie_pairs)
        day_movie_index = {dm: i for i, dm in enumerate(day_movie_pairs)}

        # Stagger intervals
        stagger_intervals = self._compute_stagger_intervals()
        num_stagger = len(stagger_intervals)

        # Предвычисляем данные по столбцам
        column_revenues = np.array([
            col.total_revenue - Q * col.movie_switches
            for col in state.columns
        ])

        # a_{hd, j} — покрытие
        A_hd = np.zeros((num_hall_days, num_columns))
        for j, col in enumerate(state.columns):
            hd = (col.hall.id, col.day)
            if hd in hall_day_index:
                A_hd[hall_day_index[hd], j] = 1.0

        # b_{dm, j} — копии
        B_dm = np.zeros((num_day_movies, num_columns))
        copies_rhs = np.zeros(num_day_movies)
        for i, (day, mid) in enumerate(day_movie_pairs):
            copies_rhs[i] = movie_map[mid].distributor_max_copies
        for j, col in enumerate(state.columns):
            for mid in col.movie_ids:
                dm = (col.day, mid)
                if dm in day_movie_index:
                    B_dm[day_movie_index[dm], j] = 1.0

        # s_{l, j} — stagger starts
        S_stag = np.zeros((num_stagger, num_columns))
        for l_idx, (day, t_start, t_end) in enumerate(stagger_intervals):
            for j, col in enumerate(state.columns):
                if col.day != day:
                    continue
                S_stag[l_idx, j] = sum(
                    1 for s in col.shows if t_start <= s.start_minutes < t_end
                )

        # Early closure h_j per day
        ec_time = self.config.early_close_time_minutes
        r_frac = self.config.early_close_fraction
        ec_per_day: dict[int, np.ndarray] = {}
        ec_rhs: dict[int, float] = {}
        for day in self.config.days:
            h_j = np.zeros(num_columns)
            n_halls_day = 0
            for hall in self.halls:
                hd = (hall.id, day)
                if hd not in hall_day_index:
                    continue
                n_halls_day += 1
                for j, col in enumerate(state.columns):
                    if (col.hall.id, col.day) == hd:
                        if col.last_show_end_minutes <= ec_time:
                            h_j[j] = 1.0
            ec_per_day[day] = h_j
            ec_rhs[day] = r_frac * n_halls_day

        # ── Инициализация множителей ──
        mu = np.zeros(num_hall_days)         # покрытие (свободный знак)
        lam = np.zeros(num_day_movies)       # копии (≥ 0)
        sigma = np.zeros(num_stagger)        # stagger (≥ 0)
        omega = {day: 0.0 for day in self.config.days}  # early closure (≥ 0)

        # LP dual prices как начальные значения mu
        for hd_pair in hall_day_pairs:
            idx = hall_day_index[hd_pair]
            mu[idx] = state.dual_prices_hall_day.get(hd_pair, 0.0)

        best_lb = -float("inf")
        max_subgradient_iters = 15 if num_columns > 2000 else 30
        step_size = 2.0
        no_improve_count = 0

        for subgrad_iter in range(max_subgradient_iters):
            # ── Приведённые стоимости c̄_j ──
            # max L(λ,μ,σ,ω) = Σ c̄_j x_j − R·Σy_l + const
            # c̄_j = (rev_j − Q·sw_j) − μ_{hd(j)} − λ·B_j + σ·S_j + ω·h_j
            # Здесь:
            #   μ — покрытие (=1, свободный знак)
            #   λ ≥ 0 — копии (≤), добавляем +λ(b−Ax) → c̄ получает −λ·B
            #   σ ≥ 0 — stagger (≥1), добавляем +σ(Sx+y−1) → c̄ получает +σ·S
            #   ω ≥ 0 — early closure (≥r), добавляем +ω(hx−r) → c̄ получает +ω·h
            reduced_costs = column_revenues.copy()
            reduced_costs -= A_hd.T @ mu         # покрытие: = 1
            reduced_costs -= B_dm.T @ lam        # копии: ≤ copies
            reduced_costs += S_stag.T @ sigma    # stagger: ≥ 1
            for day in self.config.days:
                reduced_costs += omega[day] * ec_per_day[day]  # early closure: ≥ r

            # ── Решение подзадачи: x_j = 1 если c̄_j > 0 ──
            x_lr = (reduced_costs > 0).astype(float)

            # y_l = 1 если R < σ_l (выгоднее «нарушить», т.к. штраф < множитель)
            y_lr = np.zeros(num_stagger)
            for l_idx in range(num_stagger):
                if R < sigma[l_idx]:
                    y_lr[l_idx] = 1.0

            # ── Значение Лагранжевой функции ──
            # L = Σ c̄_j x_j − R·Σy_l + μ·1 + λ·copies − σ·1 + ω·(−r·|S|)
            # Знаки:
            #   +μ·1        (покрытие = 1, оба знака)
            #   +λ·copies   (≤ copies: +λ(b−Ax), const part = +λ·b)
            #   −σ·1        (≥ 1: +σ(Sx+y−1), const part = −σ·1)
            #   −ω·r·|S|   (≥ r|S|: +ω(hx−r|S|), const part = −ω·r|S|)
            lr_value = float(reduced_costs @ x_lr) - float(R * y_lr.sum())
            lr_value += float(mu.sum())            # Σ μ · 1
            lr_value += float(lam @ copies_rhs)    # +Σ λ · copies
            lr_value -= float(sigma.sum())          # −Σ σ · 1
            for day in self.config.days:
                lr_value -= omega[day] * ec_rhs[day]  # −ω · r · |S|

            if lr_value > best_lb:
                best_lb = lr_value
                no_improve_count = 0
            else:
                no_improve_count += 1

            if no_improve_count > 8:
                step_size *= 0.5
                no_improve_count = 0
                if step_size < 0.01:
                    break

            # ── Субградиенты ──
            # g_μ = ∂L/∂μ = 1 − A·x          (покрытие: Ax = 1)
            # g_λ = ∂L/∂λ = copies − B·x      (копии: Bx ≤ copies, λ≥0)
            # g_σ = ∂L/∂σ = S·x + y − 1       (stagger: Sx+y ≥ 1, σ≥0)
            # g_ω = ∂L/∂ω = h·x − r·|S|       (early: hx ≥ r|S|, ω≥0)
            g_mu = 1.0 - A_hd @ x_lr                      # покрытие
            g_lam = copies_rhs - B_dm @ x_lr               # копии
            g_sigma = S_stag @ x_lr + y_lr - 1.0           # stagger
            g_omega = {}
            for day in self.config.days:
                g_omega[day] = float(ec_per_day[day] @ x_lr) - ec_rhs[day]

            # ── Норма субградиента ──
            subgradient_norm = (
                float(np.dot(g_mu, g_mu))
                + float(np.dot(g_lam, g_lam))
                + float(np.dot(g_sigma, g_sigma))
                + sum(v ** 2 for v in g_omega.values())
            )
            if subgradient_norm < 1e-12:
                break

            # ── Размер шага (формула Полиака) ──
            # Для max-задачи: LR(λ) ≥ OPT ≥ best_feasible.
            # α = step · (LR_val − best_feasible) / ‖g‖²
            best_feasible = state.obj_value if state.obj_value > 0 else state.lp_bound * 0.95
            diff = lr_value - best_feasible
            if diff < 0:
                diff = 0.1 * abs(best_feasible)  # LR < feasible: reset
            alpha = step_size * diff / subgradient_norm
            alpha = min(max(alpha, 1e-6), 1e4)  # ограничиваем шаг сверху

            # ── Обновление множителей ──
            mu += alpha * g_mu
            lam = np.maximum(0.0, lam + alpha * g_lam)
            sigma = np.maximum(0.0, sigma + alpha * g_sigma)
            for day in self.config.days:
                omega[day] = max(0.0, omega[day] + alpha * g_omega[day])

        state.lagrangian_bound = max(best_lb, state.lagrangian_bound)
        logger.info(
            f"Lagrangian relaxation: LB = {best_lb:.0f} "
            f"({max_subgradient_iters} subgradient iters, step={step_size:.3f})"
        )

    # Pricing step: генерация новых столбцов (Шаг 2)    

    def _pricing_step(self, state: _ColumnGenerationState) -> list[HallDaySchedule]:
        """
        Генерирует новые столбцы с положительной приведённой выручкой.
        Использует dual prices из LP / Лагранжевой релаксации.
        """
        new_columns: list[HallDaySchedule] = []
        Q = self.config.movie_switch_penalty

        for hall in self.halls:
            for day in self.config.days:
                hd = (hall.id, day)
                hd_dual = state.dual_prices_hall_day.get(hd, 0.0)

                cols = self.column_gen.generate_columns(
                    hall, day,
                    dual_prices=state.dual_prices_movie,
                )

                for col in cols:
                    # Reduced cost = c_j − π_{hd} − Σ_m λ_m · b_{m,j}
                    # π_{hd} = dual price покрытия (=1)
                    # λ_m   = dual price копий (≤ copies)
                    reduced_cost = (col.total_revenue - Q * col.movie_switches) - hd_dual
                    for mid in col.movie_ids:
                        reduced_cost -= (
                            state.dual_prices_movie.get(mid, 0.0)
                            * col.movie_show_count(mid)
                        )

                    if reduced_cost > 1e-3:  # порог для избежания числ. шума
                        if not self._column_exists(state, col):
                            new_columns.append(col)

        return new_columns
   
    # Шаг 3: IP solve — PuLP MILP или жадная эвристика    

    def _solve_ip(self, state: _ColumnGenerationState) -> None:
        """Решает целочисленную задачу через PuLP MILP-солвер."""
        self._solve_ip_pulp(state)

    def _prefilter_columns(self, state: _ColumnGenerationState, top_k: int = 20) -> tuple[list[HallDaySchedule], dict[int, int]]:
        """
        Оставляет только top-K лучших столбцов по выручке на каждую (hall, day) пару.
        Гарантирует разнообразие: для каждого фильма сохраняет хотя бы 1 столбец
        на (hall,day), если такой существует.
        Возвращает (отфильтрованные столбцы, маппинг нового индекса → старого).
        """
        Q = self.config.movie_switch_penalty
        movie_ids = {m.id for m in self.movies}

        # Группируем по (hall_id, day)
        hd_cols: dict[tuple[str, int], list[tuple[int, float]]] = {}
        for j, col in enumerate(state.columns):
            hd = (col.hall.id, col.day)
            score = col.total_revenue - Q * col.movie_switches
            hd_cols.setdefault(hd, []).append((j, score))

        # Берём top-K из каждой группы + гарантируем представленность каждого фильма
        filtered: list[HallDaySchedule] = []
        new_to_old: dict[int, int] = {}
        selected_indices: set[int] = set()

        for hd, col_list in hd_cols.items():
            col_list.sort(key=lambda x: x[1], reverse=True)
            # Сначала top-K
            for old_j, _ in col_list[:top_k]:
                selected_indices.add(old_j)

            # Затем — для каждого фильма, если его нет в top-K, добавляем лучший
            # столбец содержащий этот фильм
            top_k_movies: set[str] = set()
            for old_j, _ in col_list[:top_k]:
                top_k_movies.update(state.columns[old_j].movie_ids)

            for mid in movie_ids:
                if mid in top_k_movies:
                    continue
                # Найти лучший столбец с этим фильмом
                for old_j, _ in col_list:
                    if mid in state.columns[old_j].movie_ids:
                        selected_indices.add(old_j)
                        break

            # Для каждого из top-3 популярных фильмов, сохраняем лучшие столбцы
            # которые НЕ содержат этот фильм (чтобы maxshows constraints были выполнимы)
            all_movies_sorted = sorted(self.movies, key=lambda m: m.popularity_score, reverse=True)
            for excl_movie in all_movies_sorted[:3]:
                excl_count = 0
                for old_j, _ in col_list:
                    if excl_movie.id not in state.columns[old_j].movie_ids:
                        selected_indices.add(old_j)
                        excl_count += 1
                        if excl_count >= 5:
                            break

        for old_j in sorted(selected_indices):
            new_idx = len(filtered)
            new_to_old[new_idx] = old_j
            filtered.append(state.columns[old_j])

        logger.info(f"Pre-filter: {len(state.columns)} → {len(filtered)} columns (top-{top_k}/hd + diversity)")
        return filtered, new_to_old

    def _solve_ip_pulp(self, state: _ColumnGenerationState) -> None:
        """
        Точное решение IP через PuLP MILP-солвер (eq. 8-14 статьи).
        Включает ограничения: покрытие, копии, early closure,
        same-movie stagger, diversity bonus.

        Улучшения для крупных экземпляров:
        - Pre-filter: оставляем top-K столбцов на (hall,day)
        - Warm start из LP-решения
        - Адаптивный таймаут
        """
        num_columns_total = len(state.columns)
        if num_columns_total == 0:
            state.solution_indices = []
            state.obj_value = 0.0
            return

        # ── Pre-filter столбцов для крупных экземпляров ──
        num_hall_days = len(self.halls) * len(self.config.days)
        if num_columns_total > 3000:
            top_k = max(20, min(50, 5000 // max(num_hall_days, 1)))
            filtered_cols, new_to_old = self._prefilter_columns(state, top_k=top_k)
        else:
            filtered_cols = state.columns
            new_to_old = {j: j for j in range(num_columns_total)}

        num_columns = len(filtered_cols)

        Q = self.config.movie_switch_penalty

        # Считаем среднюю выручку столбца для масштабирования diversity bonus
        avg_col_revenue = sum(c.total_revenue for c in filtered_cols) / max(len(filtered_cols), 1)
        # D = процент от средней выручки столбца × вес из конфига
        # При D_weight=10000 и avg_col_rev=50000: D = 50000 * (10000/10000) = 50000
        D = avg_col_revenue * (self.config.diversity_bonus_weight / 10000.0)
        logger.info(f"Diversity bonus: D={D:.0f} (avg_col_rev={avg_col_revenue:.0f}, weight={self.config.diversity_bonus_weight})")

        prob = pulp.LpProblem("CinemaScheduling", pulp.LpMaximize)

        # Переменные x_j ∈ {0, 1}
        x = [pulp.LpVariable(f"x_{j}", cat="Binary") for j in range(num_columns)]

        # ── Diversity bonus: z_m_d ∈ {0,1} — фильм m показан хотя бы раз в день d ──
        movie_ids = [m.id for m in self.movies]
        z = {}  # z[(mid, day)] = binary var
        for day in self.config.days:
            for mid in movie_ids:
                z[(mid, day)] = pulp.LpVariable(f"z_{mid}_{day}", cat="Binary")

        # Целевая функция: revenue - switch penalty + diversity bonus
        # Добавляем малый случайный шум (±3%) к выручке столбцов,
        # чтобы ломать симметрию между днями и получать разные расписания
        import random
        rng = random.Random(42)  # фиксированный seed для воспроизводимости
        perturbed_rev = []
        for col in filtered_cols:
            noise = 1.0 + rng.uniform(-0.03, 0.03)
            perturbed_rev.append((col.total_revenue - Q * col.movie_switches) * noise)

        prob += (
            pulp.lpSum(
                perturbed_rev[j] * x[j]
                for j in range(num_columns)
            )
            + D * pulp.lpSum(z.values())
        )

        logger.info(f"Diversity bonus weight D={D}, movies={len(movie_ids)}, "
                    f"max possible bonus/day={D*len(movie_ids):.0f}")

        # Покрытие (eq. 10): ровно один столбец на (hall, day)
        hall_day_pairs = set()
        for hall in self.halls:
            for day in self.config.days:
                hd = (hall.id, day)
                hall_day_pairs.add(hd)
                prob += (
                    pulp.lpSum(
                        x[j] for j, col in enumerate(filtered_cols)
                        if (col.hall.id, col.day) == hd
                    ) == 1,
                    f"cover_{hd[0]}_{hd[1]}"
                )

        # Копии (eq. 9)
        for day in self.config.days:
            for movie in self.movies:
                prob += (
                    pulp.lpSum(
                        x[j] for j, col in enumerate(filtered_cols)
                        if col.day == day and movie.id in col.movie_ids
                    ) <= movie.distributor_max_copies,
                    f"copies_{day}_{movie.id}"
                )

        # ── Diversity linking: z_{m,d} ≤ Σ (count_m_j * x_j) для дня d ──
        # z_{m,d} = 1 только если фильм m показан хотя бы раз в день d
        for day in self.config.days:
            for mid in movie_ids:
                total_possible = sum(
                    col.movie_show_count(mid)
                    for col in filtered_cols if col.day == day
                )
                if total_possible > 0:
                    prob += (
                        z[(mid, day)] <= pulp.lpSum(
                            col.movie_show_count(mid) * x[j]
                            for j, col in enumerate(filtered_cols)
                            if col.day == day
                        ),
                        f"zlink_{day}_{mid}"
                    )
                else:
                    # Фильм вообще не присутствует в столбцах этого дня
                    prob += (z[(mid, day)] == 0, f"zlink_{day}_{mid}")

        # Min-shows (контрактные обязательства дистрибьютора)
        for day in self.config.days:
            for movie in self.movies:
                required = movie.distributor_min_shows_per_day
                # ensure_all_movies_shown теперь реализуется через diversity bonus
                if required > 0:
                    has_movie = any(
                        col.movie_show_count(movie.id) > 0
                        for col in filtered_cols if col.day == day
                    )
                    if has_movie:
                        prob += (
                            pulp.lpSum(
                                col.movie_show_count(movie.id) * x[j]
                                for j, col in enumerate(filtered_cols)
                                if col.day == day
                            ) >= required,
                            f"minshows_{day}_{movie.id}"
                        )

        # Max-shows per movie per day (разнообразие расписания)
        max_shows_mpd = self.config.max_shows_per_movie_per_day
        if max_shows_mpd > 0:
            for day in self.config.days:
                for movie in self.movies:
                    prob += (
                        pulp.lpSum(
                            col.movie_show_count(movie.id) * x[j]
                            for j, col in enumerate(filtered_cols)
                            if col.day == day
                        ) <= max_shows_mpd,
                        f"maxshows_{day}_{movie.id}"
                    )

        # Stagger constraints removed from MILP — diversity is now handled
        # via soft bonus in objective function (z variables).
        # Stagger intervals are still used in LP relaxation for dual prices.
        num_stagger = 0  # for compatibility with retry logic

        # Early closure (eq. 13)
        ec_time = self.config.early_close_time_minutes
        r_frac = self.config.early_close_fraction
        for day in self.config.days:
            n_halls_day = sum(
                1 for h in self.halls if (h.id, day) in hall_day_pairs
            )
            if n_halls_day > 0:
                prob += (
                    pulp.lpSum(
                        x[j] for j, col in enumerate(filtered_cols)
                        if col.day == day
                        and col.last_show_end_minutes <= ec_time
                    ) >= r_frac * n_halls_day,
                    f"early_close_{day}"
                )

        # Children morning constraint
        children_pref_latest = self.config.children_preferred_latest_start
        children_movies = [m for m in self.movies if m.is_children]
        if children_movies:
            children_movie_ids = {m.id for m in children_movies}
            for day in self.config.days:
                morning_children_expr = []
                for j, col in enumerate(filtered_cols):
                    if col.day != day:
                        continue
                    morning_count = sum(
                        1 for s in col.shows
                        if s.movie.id in children_movie_ids
                        and s.start_minutes < children_pref_latest
                    )
                    if morning_count > 0:
                        morning_children_expr.append(morning_count * x[j])
                if morning_children_expr:
                    prob += (
                        pulp.lpSum(morning_children_expr) >= 1,
                        f"children_morning_{day}"
                    )

        # Same-movie stagger across halls
        # Для крупных экземпляров пропускаем — слишком много hard constraints
        # вызывают infeasibility. Вместо этого stagger обеспечивается
        # качеством столбцов и post-processing.
        min_gap_sm = self.config.min_gap_same_movie_diff_halls
        sm_constraint_id = 0
        skip_sm_stagger = num_hall_days > 50

        if not skip_sm_stagger:
            for day in self.config.days:
                movie_starts_by_col: dict[int, dict[str, list[int]]] = {}
                all_movie_ids_day: set[str] = set()
                for j, col in enumerate(filtered_cols):
                    if col.day != day:
                        continue
                    starts_by_movie: dict[str, list[int]] = {}
                    for s in col.shows:
                        starts_by_movie.setdefault(s.movie.id, []).append(s.start_minutes)
                        all_movie_ids_day.add(s.movie.id)
                    movie_starts_by_col[j] = starts_by_movie

                all_opens = [h.open_time.hour * 60 + h.open_time.minute for h in self.halls]
                all_closes = [h.close_time.hour * 60 + h.close_time.minute for h in self.halls]
                t_min = min(all_opens) if all_opens else 540
                t_max = max(all_closes) if all_closes else 1410

                for mid in all_movie_ids_day:
                    t = t_min
                    while t < t_max:
                        t_end = t + min_gap_sm
                        cols_in_window: dict[str, list[int]] = {}
                        for j, starts_map in movie_starts_by_col.items():
                            if mid not in starts_map:
                                continue
                            if any(t <= st < t_end for st in starts_map[mid]):
                                h_id = filtered_cols[j].hall.id
                                cols_in_window.setdefault(h_id, []).append(j)

                        if len(cols_in_window) >= 2:
                            all_conflict_cols = []
                            for h_id, col_list in cols_in_window.items():
                                all_conflict_cols.extend(col_list)
                            prob += (
                                pulp.lpSum(x[j] for j in all_conflict_cols) <= 1,
                                f"sm_stagger_{sm_constraint_id}"
                            )
                            sm_constraint_id += 1
                        t += min_gap_sm

        logger.info(f"Same-movie stagger: {sm_constraint_id} conflict constraints added")

        # ── Warm start: передаём лучшее жадное решение как начальную точку ──
        best_per_hd: dict[tuple[str, int], tuple[int, float]] = {}
        for j, col in enumerate(filtered_cols):
            hd = (col.hall.id, col.day)
            rev = col.total_revenue - Q * col.movie_switches
            if hd not in best_per_hd or rev > best_per_hd[hd][1]:
                best_per_hd[hd] = (j, rev)
        warm_set = {idx for idx, _ in best_per_hd.values()}
        for j in range(num_columns):
            x[j].setInitialValue(1.0 if j in warm_set else 0.0)
        # Warm start z variables based on warm_set movies
        warm_movies_per_day: dict[tuple[str, int], bool] = {}
        for j in warm_set:
            col = filtered_cols[j]
            for mid in col.movie_ids:
                warm_movies_per_day[(mid, col.day)] = True
        for (mid, day), var in z.items():
            var.setInitialValue(1.0 if (mid, day) in warm_movies_per_day else 0.0)

        # ── Адаптивный таймаут ──
        if num_columns < 1000:
            milp_time_limit = 90
        elif num_columns < 3000:
            milp_time_limit = 120
        else:
            milp_time_limit = 60  # pre-filtered, should be fast

        logger.info(f"MILP: {num_columns} vars, timeout={milp_time_limit}s")
        prob.solve(pulp.PULP_CBC_CMD(
            msg=0,
            timeLimit=milp_time_limit,
            warmStart=True,
        ))

        # Если infeasible — пробуем поэтапно ослабляя ограничения
        if prob.status not in (pulp.constants.LpStatusOptimal, 1):
            logger.warning(f"MILP infeasible (status={prob.status}), retrying without stagger+copies+children+early")
            # Шаг 1: убираем stagger + copies + children + early + minshows (СОХРАНЯЕМ maxshows + diversity)
            for i in range(sm_constraint_id):
                cname = f"sm_stagger_{i}"
                if cname in prob.constraints:
                    del prob.constraints[cname]
            for day in self.config.days:
                for movie in self.movies:
                    cname = f"copies_{day}_{movie.id}"
                    if cname in prob.constraints:
                        del prob.constraints[cname]
                    cname = f"minshows_{day}_{movie.id}"
                    if cname in prob.constraints:
                        del prob.constraints[cname]
                cname = f"children_morning_{day}"
                if cname in prob.constraints:
                    del prob.constraints[cname]
                cname = f"early_close_{day}"
                if cname in prob.constraints:
                    del prob.constraints[cname]
            prob.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=milp_time_limit, warmStart=True))

        if prob.status not in (pulp.constants.LpStatusOptimal, 1):
            # Шаг 2a: ослабляем maxshows до 5 (оставляем diversity)
            relaxed_a = min(5, len(self.halls))
            logger.warning(f"MILP still infeasible (status={prob.status}), relaxing maxshows to {relaxed_a}")
            for day in self.config.days:
                for movie in self.movies:
                    cname = f"maxshows_{day}_{movie.id}"
                    if cname in prob.constraints:
                        del prob.constraints[cname]
                    prob += (
                        pulp.lpSum(
                            col.movie_show_count(movie.id) * x[j]
                            for j, col in enumerate(filtered_cols)
                            if col.day == day
                        ) <= relaxed_a,
                        f"maxshows_relaxed_{day}_{movie.id}"
                    )
            prob.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=milp_time_limit, warmStart=True))

        if prob.status not in (pulp.constants.LpStatusOptimal, 1):
            # Шаг 2b: ослабляем maxshows до числа залов (оставляем diversity)
            relaxed = len(self.halls)
            logger.warning(f"MILP still infeasible (status={prob.status}), relaxing maxshows to {relaxed}")
            for day in self.config.days:
                for movie in self.movies:
                    cname = f"maxshows_{day}_{movie.id}"
                    if cname in prob.constraints:
                        del prob.constraints[cname]
                    cname = f"maxshows_relaxed_{day}_{movie.id}"
                    if cname in prob.constraints:
                        del prob.constraints[cname]
                    prob += (
                        pulp.lpSum(
                            col.movie_show_count(movie.id) * x[j]
                            for j, col in enumerate(filtered_cols)
                            if col.day == day
                        ) <= relaxed,
                        f"maxshows_relaxed2_{day}_{movie.id}"
                    )
            prob.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=milp_time_limit, warmStart=True))

        if prob.status not in (pulp.constants.LpStatusOptimal, 1):
            logger.warning(f"MILP still infeasible (status={prob.status}), removing maxshows + diversity")
            # Шаг 3 (последний): убираем maxshows + diversity
            for day in self.config.days:
                for movie in self.movies:
                    for prefix in ["maxshows_relaxed2_", "maxshows_relaxed_", "maxshows_"]:
                        cname = f"{prefix}{day}_{movie.id}"
                        if cname in prob.constraints:
                            del prob.constraints[cname]
                for mid in movie_ids:
                    cname = f"zlink_{day}_{mid}"
                    if cname in prob.constraints:
                        del prob.constraints[cname]
                    prob += (z[(mid, day)] == 0, f"zdisable_{day}_{mid}")
            prob.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=milp_time_limit, warmStart=True))

        is_greedy = False
        if prob.status in (pulp.constants.LpStatusOptimal, 1):
            selected_filtered = [
                j for j in range(num_columns) if pulp.value(x[j]) is not None and pulp.value(x[j]) > 0.5
            ]
            # Маппим обратно на оригинальные индексы
            state.solution_indices = [new_to_old[j] for j in selected_filtered]
            state.obj_value = pulp.value(prob.objective) or 0.0
            logger.info(f"PuLP MILP status={prob.status}: obj = {state.obj_value:.0f}")
        else:
            logger.warning(f"PuLP MILP status = {prob.status}, falling back to greedy")
            is_greedy = True
            # Fallback: выбрать лучший столбец для каждой (hall, day) пары
            best_per_hd_orig: dict[tuple[str, int], tuple[int, float]] = {}
            for j, col in enumerate(state.columns):
                hd = (col.hall.id, col.day)
                rev = col.total_revenue
                if hd not in best_per_hd_orig or rev > best_per_hd_orig[hd][1]:
                    best_per_hd_orig[hd] = (j, rev)
            state.solution_indices = [idx for idx, _ in best_per_hd_orig.values()]
            state.obj_value = sum(state.columns[j].total_revenue for j in state.solution_indices)

        state._is_greedy_fallback = is_greedy

    # Утилиты    

    def _compute_stagger_intervals(self) -> list[tuple[int, int, int]]:
        """
        Вычисляет интервалы staggering для всех дней.
        Возвращает список (day, t_start, t_end) кортежей.
        """
        max_gap = self.config.max_gap_between_starts
        intervals: list[tuple[int, int, int]] = []
        for day in self.config.days:
            all_opens = [h.open_time.hour * 60 + h.open_time.minute for h in self.halls]
            all_closes = [h.close_time.hour * 60 + h.close_time.minute for h in self.halls]
            t_min = min(all_opens) if all_opens else 540
            t_max = max(all_closes) if all_closes else 1410
            t = t_min
            while t + max_gap <= t_max:
                intervals.append((day, t, t + max_gap))
                t += max_gap
        return intervals

    def _compute_hall_day_pairs(self) -> list[tuple[str, int]]:
        """Возвращает список пар (hall_id, day) для всех залов и дней."""
        pairs: list[tuple[str, int]] = []
        for hall in self.halls:
            for day in self.config.days:
                pairs.append((hall.id, day))
        return pairs

    @staticmethod
    def _column_exists(state: _ColumnGenerationState, col: HallDaySchedule) -> bool:
        """Проверяет, существует ли уже такой столбец (по набору сеансов)."""
        col_signature = (
            col.hall.id,
            col.day,
            tuple((s.movie.id, s.start_minutes) for s in col.shows),
        )
        for existing in state.columns:
            existing_sig = (
                existing.hall.id,
                existing.day,
                tuple((s.movie.id, s.start_minutes) for s in existing.shows),
            )
            if col_signature == existing_sig:
                return True
        return False
