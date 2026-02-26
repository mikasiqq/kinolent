import { makeAutoObservable, runInAction } from "mobx";
import type {
  CinemaSchedule,
  ScheduleShow,
  HallDaySchedule,
  HallConfig,
  GenerationConfig,
  GenerationStatus,
  GenerationStep,
  ScheduleMetrics,
} from "@/types/schedule";
import { movieStore } from "./movieStore";
import { generateScheduleViaWs, checkHealth } from "@/services/api";

/** Демо-залы */
const DEMO_HALLS: HallConfig[] = [
  {
    id: "h1",
    name: "Зал 1 — Большой",
    capacity: 300,
    hallType: "2D",
    cleaningMinutes: 15,
    openTime: "09:00",
    closeTime: "23:30",
    enabled: true,
  },
  {
    id: "h2",
    name: "Зал 2 — IMAX",
    capacity: 200,
    hallType: "IMAX",
    cleaningMinutes: 20,
    openTime: "10:00",
    closeTime: "23:00",
    enabled: true,
  },
  {
    id: "h3",
    name: "Зал 3 — Комфорт",
    capacity: 120,
    hallType: "3D",
    cleaningMinutes: 15,
    openTime: "09:00",
    closeTime: "23:30",
    enabled: true,
  },
  {
    id: "h4",
    name: "Зал 4 — VIP",
    capacity: 50,
    hallType: "VIP",
    cleaningMinutes: 20,
    openTime: "11:00",
    closeTime: "23:00",
    enabled: true,
  },
];

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
    scheduleName: "Расписание на неделю",
    days: 7,
    halls: [...DEMO_HALLS],
    staggerMinutes: 5,
    maxColumnsPerIteration: 100,
    lpTimeLimitSeconds: 30,
    antiCrowding: true,
    childrenDaytimeOnly: true,
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

  /** Генерация расписания через реальный бэкенд (WebSocket) */
  async generateSchedule() {
    this.generationStatus = "generating";
    this.generationProgress = 0;
    this.generationSteps = [
      { label: "Инициализация", description: "Подготовка данных и параметров", status: "active" },
      { label: "Генерация столбцов", description: "Column Generation — поиск допустимых расписаний залов", status: "pending" },
      { label: "LP-релаксация", description: "Решение линейной релаксации мастер-задачи", status: "pending" },
      { label: "Целочисленное решение", description: "MILP — получение финального расписания", status: "pending" },
      { label: "Пост-обработка", description: "Расчёт прогнозов и метрик качества", status: "pending" },
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
      runInAction(() => { this.generationStatus = "error"; });
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
}

export const scheduleStore = new ScheduleStore();
