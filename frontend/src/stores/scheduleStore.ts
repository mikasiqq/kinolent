import type { RatingsDetailResponse } from "@/services/api";
import {
  checkHealth,
  deleteScheduleFromDb,
  fetchHalls,
  fetchRatings,
  fetchSchedulesFromDb,
  generateScheduleViaWs,
  patchSchedule,
  saveScheduleToDb,
  submitRating,
} from "@/services/api";
import type {
  CinemaSchedule,
  GenerationConfig,
  GenerationStatus,
  GenerationStep,
  HallDaySchedule,
  ScheduleMetrics,
  ScheduleShow,
} from "@/types/schedule";
import { makeAutoObservable, runInAction } from "mobx";
import { movieStore } from "./movieStore";

/** Параметры генерации по умолчанию */
const DEFAULT_CONFIG: Omit<GenerationConfig, "halls"> = {
  scheduleName: "Расписание на неделю",
  days: 7,
  staggerMinutes: 5,
  maxColumnsPerIteration: 100,
  lpTimeLimitSeconds: 30,
  antiCrowding: true,
  childrenDaytimeOnly: true,
};

/** Генерация демо-расписания */
function generateDemoSchedule(config: GenerationConfig): CinemaSchedule {
  const activeMovies = movieStore.movies.filter((m) => m.isActive);
  const enabledHalls = config.halls.filter((h) => h.enabled);
  const hallSchedules: HallDaySchedule[] = [];
  let totalRevenue = 0;
  let totalAttendance = 0;
  let totalShows = 0;
  let showIdCounter = 1;

  for (let day = 0; day < config.days; day++) {
    for (const hall of enabledHalls) {
      const openMinutes = parseTime(hall.openTime);
      const closeMinutes = parseTime(hall.closeTime);
      const shows: ScheduleShow[] = [];
      let currentTime = openMinutes;

      while (currentTime + 90 <= closeMinutes && activeMovies.length > 0) {
        // Выбираем фильм (ротация)
        const movieIndex =
          (showIdCounter + day * 3 + enabledHalls.indexOf(hall) * 2) %
          activeMovies.length;
        const movie = activeMovies[movieIndex];
        const totalSlot = movie.duration + 15; // ad block
        const endTime = currentTime + totalSlot;

        if (endTime > closeMinutes) break;

        const baseAttendance = hall.capacity * (0.3 + movie.popularity * 0.06);
        const dayMultiplier = day >= 5 ? 1.4 : 1.0; // выходные
        const timeMultiplier =
          currentTime >= 18 * 60 ? 1.3 : currentTime >= 12 * 60 ? 1.0 : 0.7;
        const attendance = Math.round(
          baseAttendance * dayMultiplier * timeMultiplier,
        );
        const revenue = attendance * 350;

        shows.push({
          id: `s${showIdCounter++}`,
          movieId: movie.id,
          movieTitle: movie.title,
          movieDuration: movie.duration,
          adBlockMinutes: 15,
          hallId: hall.id,
          hallName: hall.name,
          day,
          startMinutes: currentTime,
          endMinutes: endTime,
          predictedAttendance: attendance,
          predictedRevenue: revenue,
          genre: movie.genre,
          ageRating: movie.ageRating,
          posterUrl: movie.posterUrl,
        });

        totalRevenue += revenue;
        totalAttendance += attendance;
        totalShows++;

        // Следующий слот (+ уборка + stagger)
        currentTime = endTime + hall.cleaningMinutes + config.staggerMinutes;
      }

      hallSchedules.push({
        hallId: hall.id,
        hallName: hall.name,
        day,
        shows,
        totalRevenue: shows.reduce((s, sh) => s + sh.predictedRevenue, 0),
        totalAttendance: shows.reduce((s, sh) => s + sh.predictedAttendance, 0),
      });
    }
  }

  const metrics: ScheduleMetrics = {
    lpBound: totalRevenue * 1.03,
    ipObjective: totalRevenue,
    gapPct: 2.8,
    generationTimeMs: 1200 + Math.random() * 800,
    columnsGenerated: 42 + Math.floor(Math.random() * 30),
  };

  return {
    id: crypto.randomUUID(),
    name: config.scheduleName,
    createdAt: new Date().toISOString(),
    days: config.days,
    hallSchedules,
    totalRevenue,
    totalAttendance,
    totalShows,
    metrics,
  };
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** MobX стор для расписания */
class ScheduleStore {
  schedules: CinemaSchedule[] = [];
  currentScheduleId: string | null = null;
  selectedDay = 0;

  /** Конфигурация генерации */
  config: GenerationConfig = {
    ...DEFAULT_CONFIG,
    halls: [],
  };

  generationStatus: GenerationStatus = "idle";
  generationProgress = 0;
  generationSteps: GenerationStep[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  /** Текущее расписание */
  get currentSchedule(): CinemaSchedule | undefined {
    return this.schedules.find((s) => s.id === this.currentScheduleId);
  }

  /** Расписания залов для выбранного дня */
  get currentDaySchedules(): HallDaySchedule[] {
    if (!this.currentSchedule) return [];
    return this.currentSchedule.hallSchedules.filter(
      (hs) => hs.day === this.selectedDay,
    );
  }

  /** Все сеансы текущего дня */
  get currentDayShows(): ScheduleShow[] {
    return this.currentDaySchedules.flatMap((hs) => hs.shows);
  }

  /** Уникальные залы в текущем расписании */
  get uniqueHalls(): { id: string; name: string }[] {
    if (!this.currentSchedule) return [];
    const seen = new Set<string>();
    const halls: { id: string; name: string }[] = [];
    for (const hs of this.currentSchedule.hallSchedules) {
      if (!seen.has(hs.hallId)) {
        seen.add(hs.hallId);
        halls.push({ id: hs.hallId, name: hs.hallName });
      }
    }
    return halls;
  }

  /** Статистика по текущему дню */
  get currentDayStats() {
    const shows = this.currentDayShows;
    return {
      totalShows: shows.length,
      totalRevenue: shows.reduce((s, sh) => s + sh.predictedRevenue, 0),
      totalAttendance: shows.reduce((s, sh) => s + sh.predictedAttendance, 0),
      avgOccupancy:
        shows.length > 0
          ? Math.round(
              shows.reduce((s, sh) => s + sh.predictedAttendance, 0) /
                shows.length,
            )
          : 0,
    };
  }

  /** Выбрать день */
  setSelectedDay(day: number) {
    this.selectedDay = day;
  }

  /** Выбрать расписание */
  selectSchedule(id: string) {
    this.currentScheduleId = id;
    this.selectedDay = 0;
  }

  /** Удалить расписание */
  deleteSchedule(id: string) {
    this.schedules = this.schedules.filter((s) => s.id !== id);
    if (this.currentScheduleId === id) {
      this.currentScheduleId =
        this.schedules.length > 0 ? this.schedules[0].id : null;
    }
    // Удаляем из БД асинхронно
    deleteScheduleFromDb(id).catch((e) =>
      console.warn("deleteScheduleFromDb failed:", e),
    );
  }

  /** Обновить конфигурацию */
  updateConfig(updates: Partial<GenerationConfig>) {
    Object.assign(this.config, updates);
  }

  /** Включить/выключить зал */
  toggleHall(hallId: string) {
    const hall = this.config.halls.find((h) => h.id === hallId);
    if (hall) hall.enabled = !hall.enabled;
  }

  /** Загрузить залы из API */
  async fetchHalls() {
    try {
      const halls = await fetchHalls();
      runInAction(() => {
        this.config.halls = halls;
      });
    } catch (e) {
      console.warn("fetchHalls failed, keeping current halls:", e);
    }
  }

  /** Загрузить историю расписаний из БД */
  async loadSchedules() {
    try {
      const schedules = await fetchSchedulesFromDb();
      runInAction(() => {
        this.schedules = schedules;
        if (schedules.length > 0 && !this.currentScheduleId) {
          this.currentScheduleId = schedules[0].id;
        }
      });
    } catch (e) {
      console.warn("loadSchedules failed:", e);
    }
  }

  /** Генерация расписания через реальный бэкенд (WebSocket) */
  async generateSchedule() {
    this.generationStatus = "generating";
    this.generationProgress = 0;
    this.generationSteps = [
      {
        label: "Инициализация",
        description: "Подготовка данных и параметров",
        status: "active",
      },
      {
        label: "Генерация столбцов",
        description: "Column Generation — поиск допустимых расписаний залов",
        status: "pending",
      },
      {
        label: "LP-релаксация",
        description: "Решение линейной релаксации мастер-задачи",
        status: "pending",
      },
      {
        label: "Целочисленное решение",
        description: "MILP — получение финального расписания",
        status: "pending",
      },
      {
        label: "Пост-обработка",
        description: "Расчёт прогнозов и метрик качества",
        status: "pending",
      },
    ];

    // Проверяем доступность бэкенда
    const backendAvailable = await checkHealth();

    if (!backendAvailable) {
      // Fallback: демо-режим (если бэкенд не запущен)
      console.warn("Backend unavailable — using demo schedule");
      await this._runDemoFallback();
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this._cancelGeneration = generateScheduleViaWs(
        this.config,
        movieStore.movies,
        {
          onStep: (steps, progress) => {
            runInAction(() => {
              this.generationSteps = steps;
              this.generationProgress = progress;
            });
          },
          onDone: (schedule) => {
            runInAction(() => {
              this.schedules.unshift(schedule);
              this.currentScheduleId = schedule.id;
              this.selectedDay = 0;
              this.generationStatus = "completed";
              this.generationProgress = 100;
              this.generationSteps = this.generationSteps.map((s) => ({
                ...s,
                status: "completed" as const,
              }));
            });
            // Сохраняем в БД асинхронно (не блокируем UI)
            saveScheduleToDb(schedule).catch((e) =>
              console.warn("saveSchedule failed:", e),
            );
            resolve();
          },
          onError: (message) => {
            runInAction(() => {
              this.generationStatus = "error";
              this.generationSteps = this.generationSteps.map((s) =>
                s.status === "active" ? { ...s, status: "error" as const } : s,
              );
            });
            console.error("Generation error:", message);
            reject(new Error(message));
          },
        },
      );
    }).catch(() => {
      // Ошибки уже обработаны в onError
    });
  }

  private _cancelGeneration: (() => void) | null = null;

  /** Отменить текущую генерацию */
  cancelGeneration() {
    if (this._cancelGeneration) {
      this._cancelGeneration();
      this._cancelGeneration = null;
    }
    runInAction(() => {
      this.generationStatus = "idle";
      this.generationProgress = 0;
      this.generationSteps = [];
    });
  }

  /** Демо-режим (fallback когда бэкенд недоступен) */
  private async _runDemoFallback() {
    try {
      await this.simulateStep(0, 15);
      await this.simulateStep(1, 40);
      await this.simulateStep(2, 25);
      await this.simulateStep(3, 15);
      await this.simulateStep(4, 5);
      const schedule = generateDemoSchedule(this.config);
      runInAction(() => {
        this.schedules.unshift(schedule);
        this.currentScheduleId = schedule.id;
        this.selectedDay = 0;
        this.generationStatus = "completed";
        this.generationProgress = 100;
      });
    } catch {
      runInAction(() => {
        this.generationStatus = "error";
      });
    }
  }

  private async simulateStep(stepIndex: number, progressAdd: number) {
    runInAction(() => {
      if (stepIndex > 0) {
        this.generationSteps[stepIndex - 1].status = "completed";
      }
      this.generationSteps[stepIndex].status = "active";
    });

    const steps = 10;
    const perStep = progressAdd / steps;
    for (let i = 0; i < steps; i++) {
      await new Promise((r) => setTimeout(r, 80 + Math.random() * 120));
      runInAction(() => {
        this.generationProgress = Math.min(
          100,
          this.generationProgress + perStep,
        );
      });
    }

    runInAction(() => {
      this.generationSteps[stepIndex].status = "completed";
    });
  }

  /** Сброс генерации */
  resetGeneration() {
    this.generationStatus = "idle";
    this.generationProgress = 0;
    this.generationSteps = [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULE EDITING
  // ═══════════════════════════════════════════════════════════════════════════

  /** Переименовать расписание */
  async renameSchedule(id: string, name: string) {
    const schedule = this.schedules.find((s) => s.id === id);
    if (!schedule) return;
    schedule.name = name;
    patchSchedule(id, { name }).catch((e) =>
      console.warn("patchSchedule rename failed:", e),
    );
  }

  /**
   * Проверяет, пересекается ли временной интервал с другими сеансами
   * в том же зале и дне. Возвращает конфликтующий сеанс или null.
   */
  checkOverlap(
    hallId: string,
    day: number,
    startMinutes: number,
    endMinutes: number,
    excludeShowId?: string,
  ): ScheduleShow | null {
    const schedule = this.currentSchedule;
    if (!schedule) return null;

    const hs = schedule.hallSchedules.find(
      (h) => h.hallId === hallId && h.day === day,
    );
    if (!hs) return null;

    for (const other of hs.shows) {
      if (other.id === excludeShowId) continue;
      // Два интервала пересекаются, если start < otherEnd && end > otherStart
      if (startMinutes < other.endMinutes && endMinutes > other.startMinutes) {
        return other;
      }
    }
    return null;
  }

  /** Удалить конкретный сеанс из расписания */
  removeShow(showId: string) {
    const schedule = this.currentSchedule;
    if (!schedule) return;

    for (const hs of schedule.hallSchedules) {
      const idx = hs.shows.findIndex((s) => s.id === showId);
      if (idx !== -1) {
        const show = hs.shows[idx];
        schedule.totalRevenue -= show.predictedRevenue;
        schedule.totalAttendance -= show.predictedAttendance;
        schedule.totalShows -= 1;
        hs.totalRevenue -= show.predictedRevenue;
        hs.totalAttendance -= show.predictedAttendance;
        hs.shows.splice(idx, 1);
        break;
      }
    }
    this._persistCurrentSchedule();
  }

  /** Обновить время сеанса. Возвращает ошибку пересечения или null. */
  updateShowTime(showId: string, newStartMinutes: number): string | null {
    const schedule = this.currentSchedule;
    if (!schedule) return null;

    for (const hs of schedule.hallSchedules) {
      const show = hs.shows.find((s) => s.id === showId);
      if (show) {
        const duration = show.endMinutes - show.startMinutes;
        const newEnd = newStartMinutes + duration;

        const conflict = this.checkOverlap(
          show.hallId,
          show.day,
          newStartMinutes,
          newEnd,
          showId,
        );
        if (conflict) {
          return `Пересечение с «${conflict.movieTitle}» (${this._fmtTime(conflict.startMinutes)}–${this._fmtTime(conflict.endMinutes)})`;
        }

        show.startMinutes = newStartMinutes;
        show.endMinutes = newEnd;
        break;
      }
    }
    this._persistCurrentSchedule();
    return null;
  }

  /** Заменить фильм в сеансе. Возвращает ошибку пересечения или null. */
  replaceShowMovie(
    showId: string,
    movie: {
      id: string;
      title: string;
      duration: number;
      genre: string;
      ageRating: string;
      posterUrl?: string;
    },
  ): string | null {
    const schedule = this.currentSchedule;
    if (!schedule) return null;

    for (const hs of schedule.hallSchedules) {
      const show = hs.shows.find((s) => s.id === showId);
      if (show) {
        const newEnd = show.startMinutes + movie.duration + show.adBlockMinutes;

        const conflict = this.checkOverlap(
          show.hallId,
          show.day,
          show.startMinutes,
          newEnd,
          showId,
        );
        if (conflict) {
          return `Фильм «${movie.title}» (${movie.duration} мин) создаёт пересечение с «${conflict.movieTitle}» (${this._fmtTime(conflict.startMinutes)}–${this._fmtTime(conflict.endMinutes)})`;
        }

        show.movieId = movie.id;
        show.movieTitle = movie.title;
        show.movieDuration = movie.duration;
        show.genre = movie.genre;
        show.ageRating = movie.ageRating;
        show.posterUrl = movie.posterUrl;
        show.endMinutes = newEnd;
        break;
      }
    }
    this._persistCurrentSchedule();
    return null;
  }

  /** Переместить сеанс между залами / днями. Возвращает ошибку или null. */
  moveShow(
    showId: string,
    targetHallId: string,
    targetHallName: string,
    targetDay: number,
  ): string | null {
    const schedule = this.currentSchedule;
    if (!schedule) return null;

    // Find show first (without removing) to check overlap
    let sourceShow: ScheduleShow | null = null;
    for (const hs of schedule.hallSchedules) {
      const s = hs.shows.find((s) => s.id === showId);
      if (s) {
        sourceShow = s;
        break;
      }
    }
    if (!sourceShow) return null;

    // Check overlap at target
    const duration = sourceShow.endMinutes - sourceShow.startMinutes;
    const conflict = this.checkOverlap(
      targetHallId,
      targetDay,
      sourceShow.startMinutes,
      sourceShow.startMinutes + duration,
      showId,
    );
    if (conflict) {
      return `Пересечение с «${conflict.movieTitle}» (${this._fmtTime(conflict.startMinutes)}–${this._fmtTime(conflict.endMinutes)})`;
    }

    // Now safe to remove from source
    for (const hs of schedule.hallSchedules) {
      const idx = hs.shows.findIndex((s) => s.id === showId);
      if (idx !== -1) {
        hs.shows.splice(idx, 1);
        hs.totalRevenue -= sourceShow.predictedRevenue;
        hs.totalAttendance -= sourceShow.predictedAttendance;
        break;
      }
    }

    const show = { ...sourceShow };
    // Update show
    show.hallId = targetHallId;
    show.hallName = targetHallName;
    show.day = targetDay;

    // Find or create target HallDaySchedule
    let target = schedule.hallSchedules.find(
      (hs) => hs.hallId === targetHallId && hs.day === targetDay,
    );
    if (!target) {
      target = {
        hallId: targetHallId,
        hallName: targetHallName,
        day: targetDay,
        shows: [],
        totalRevenue: 0,
        totalAttendance: 0,
      };
      schedule.hallSchedules.push(target);
    }
    target.shows.push(show);
    target.shows.sort((a, b) => a.startMinutes - b.startMinutes);
    target.totalRevenue += show.predictedRevenue;
    target.totalAttendance += show.predictedAttendance;

    this._persistCurrentSchedule();
    return null;
  }

  /** Format minutes to HH:MM */
  private _fmtTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  /** Persist current schedule to DB */
  private _persistCurrentSchedule() {
    const s = this.currentSchedule;
    if (!s) return;
    patchSchedule(s.id, {
      data: s as unknown as Record<string, unknown>,
      totalRevenue: s.totalRevenue,
      totalAttendance: s.totalAttendance,
      totalShows: s.totalShows,
    }).catch((e) => console.warn("patchSchedule failed:", e));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULE RATINGS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Рейтинги текущего расписания */
  ratingsData: RatingsDetailResponse | null = null;
  ratingsLoading = false;

  /** Загрузить рейтинги текущего расписания */
  async loadRatings(scheduleId: string) {
    this.ratingsLoading = true;
    try {
      const data = await fetchRatings(scheduleId);
      runInAction(() => {
        this.ratingsData = data;
      });
    } catch (e) {
      console.warn("loadRatings failed:", e);
    } finally {
      runInAction(() => {
        this.ratingsLoading = false;
      });
    }
  }

  /** Отправить оценку */
  async rateSchedule(scheduleId: string, rating: number, comment?: string) {
    try {
      const result = await submitRating(scheduleId, rating, comment);
      runInAction(() => {
        if (this.ratingsData) {
          this.ratingsData.averageRating = result.averageRating;
          this.ratingsData.totalRatings = result.totalRatings;
          this.ratingsData.myRating = result.myRating;
          this.ratingsData.myComment = result.myComment;
        } else {
          this.ratingsData = {
            averageRating: result.averageRating,
            totalRatings: result.totalRatings,
            myRating: result.myRating,
            myComment: result.myComment,
            ratings: [],
          };
        }
      });
      // Reload full ratings
      this.loadRatings(scheduleId);
    } catch (e) {
      console.warn("rateSchedule failed:", e);
    }
  }
}

export const scheduleStore = new ScheduleStore();
