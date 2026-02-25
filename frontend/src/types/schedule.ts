/** Тип кинозала */
export type HallType = "2D" | "3D" | "IMAX" | "DOLBY_ATMOS" | "VIP";

/** Кинозал */
export interface Hall {
  id: string;
  name: string;
  capacity: number;
  hallType: HallType;
  cleaningMinutes: number;
  floor: number;
  openTime: string; // "HH:MM"
  closeTime: string; // "HH:MM"
}

/** Сеанс в расписании */
export interface ScheduleShow {
  id: string;
  movieId: string;
  movieTitle: string;
  movieDuration: number; // длительность фильма (мин)
  adBlockMinutes: number;
  hallId: string;
  hallName: string;
  day: number; // 0=пн...6=вс
  startMinutes: number; // от полуночи
  endMinutes: number;
  predictedAttendance: number;
  predictedRevenue: number;
  genre: string;
  ageRating: string;
  posterUrl?: string;
}

/** Расписание зала на один день */
export interface HallDaySchedule {
  hallId: string;
  hallName: string;
  day: number;
  shows: ScheduleShow[];
  totalRevenue: number;
  totalAttendance: number;
}

/** Полное расписание кинотеатра */
export interface CinemaSchedule {
  id: string;
  name: string;
  createdAt: string;
  days: number; // количество дней
  hallSchedules: HallDaySchedule[];
  totalRevenue: number;
  totalAttendance: number;
  totalShows: number;
  metrics: ScheduleMetrics;
}

/** Метрики оптимизации */
export interface ScheduleMetrics {
  lpBound: number;
  ipObjective: number;
  gapPct: number;
  generationTimeMs: number;
  columnsGenerated: number;
}

/** Параметры генерации расписания */
export interface GenerationConfig {
  scheduleName: string;
  days: number;
  halls: HallConfig[];
  staggerMinutes: number;
  maxColumnsPerIteration: number;
  lpTimeLimitSeconds: number;
  antiCrowding: boolean;
  childrenDaytimeOnly: boolean;
}

/** Конфигурация зала для генерации */
export interface HallConfig {
  id: string;
  name: string;
  capacity: number;
  hallType: HallType;
  cleaningMinutes: number;
  openTime: string;
  closeTime: string;
  enabled: boolean;
}

/** Статус генерации */
export type GenerationStatus =
  | "idle"
  | "configuring"
  | "generating"
  | "completed"
  | "error";

/** Этап генерации (для прогресс-бара) */
export interface GenerationStep {
  label: string;
  description: string;
  status: "pending" | "active" | "completed" | "error";
}

/** Человекочитаемые названия дней недели */
export const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
export const DAY_NAMES_FULL = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
] as const;

/** Человекочитаемые типы залов */
export const HALL_TYPE_LABELS: Record<HallType, string> = {
  "2D": "2D Стандарт",
  "3D": "3D",
  IMAX: "IMAX",
  DOLBY_ATMOS: "Dolby Atmos",
  VIP: "VIP",
};

/** Форматирование минут в время */
export function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Цвета для залов */
export const HALL_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-lime-500",
] as const;
