/**
 * api.ts — клиент для Kinolent Backend API (FastAPI + WebSocket)
 *
 * Экспортирует:
 *   - generateScheduleViaWs()  — WebSocket-генерация с прогрессом
 *   - generateScheduleHttp()   — REST-генерация (без прогресса)
 *   - checkHealth()            — проверка доступности сервера
 *   - fetchMovies/createMovie/updateMovie/deleteMovie/toggleMovie
 *   - fetchHalls/createHall/updateHall/deleteHall
 *   - fetchSchedules/saveSchedule/deleteScheduleFromDb
 */

import type { Movie, MovieFormData } from "@/types/movie";
import type {
  CinemaSchedule,
  GenerationConfig,
  GenerationStep,
  HallConfig,
} from "@/types/schedule";

// ── URL конфигурация ──────────────────────────────────────────────────────────

const API_BASE =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ??
  "http://localhost:8000";

const WS_BASE = API_BASE.replace(/^http/, "ws");

// ── Auth helpers ──────────────────────────────────────────────────────────────

const ACCESS_KEY = "kinolent_access_token";
const REFRESH_KEY = "kinolent_refresh_token";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(ACCESS_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function jsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", ...authHeaders() };
}

/** Автоматический refresh при 401 и повтор запроса. */
let _refreshPromise: Promise<boolean> | null = null;

async function _doRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    localStorage.setItem(ACCESS_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let res = await fetch(input, init);
  if (res.status !== 401) return res;

  // Одновременный refresh — дедупликация
  if (!_refreshPromise) {
    _refreshPromise = _doRefresh().finally(() => {
      _refreshPromise = null;
    });
  }
  const ok = await _refreshPromise;
  if (!ok) return res; // refresh failed — вернуть 401

  // Повторить запрос с новым токеном
  const newInit = { ...init, headers: { ...init?.headers, ...authHeaders() } };
  res = await fetch(input, newInit);
  return res;
}

function wsUrl(): string {
  const token = localStorage.getItem("kinolent_access_token");
  return token
    ? `${WS_BASE}/ws/generate?token=${token}`
    : `${WS_BASE}/ws/generate`;
}

// ── Типы ответов API ──────────────────────────────────────────────────────────

interface ApiShow {
  id: string;
  movieId: string;
  movieTitle: string;
  movieDuration: number;
  adBlockMinutes: number;
  hallId: string;
  hallName: string;
  day: number;
  startMinutes: number;
  endMinutes: number;
  predictedAttendance: number;
  predictedRevenue: number;
  genre: string;
  ageRating: string;
  posterUrl?: string;
}

interface ApiHallDaySchedule {
  hallId: string;
  hallName: string;
  day: number;
  shows: ApiShow[];
  totalRevenue: number;
  totalAttendance: number;
}

interface ApiScheduleOut {
  id: string;
  name: string;
  createdAt: string;
  totalShows: number;
  totalRevenue: number;
  totalAttendance: number;
  hallSchedules: ApiHallDaySchedule[];
  metrics: {
    lpBound: number;
    ipObjective: number;
    gapPct: number;
    generationTimeMs: number;
    columnsGenerated: number;
  };
  qualityReport?: {
    totalMovieSwitches: number;
    staggerViolations: number;
  } | null;
}

/** WebSocket сообщение — шаг прогресса */
interface WsStepUpdate {
  type: "step";
  stepIndex: number;
  label: string;
  description: string;
  status: "pending" | "active" | "completed" | "error";
  progress: number;
}

/** WebSocket сообщение — готово */
interface WsDone {
  type: "done";
  schedule: ApiScheduleOut;
}

/** WebSocket сообщение — ошибка */
interface WsError {
  type: "error";
  message: string;
}

type WsMessage = WsStepUpdate | WsDone | WsError;

// ── Конвертация API → фронтенд-типы ─────────────────────────────────────────

function mapSchedule(api: ApiScheduleOut): CinemaSchedule {
  return {
    id: api.id,
    name: api.name,
    createdAt: api.createdAt,
    days:
      api.hallSchedules.length > 0
        ? Math.max(...api.hallSchedules.map((hs) => hs.day)) + 1
        : 1,
    hallSchedules: api.hallSchedules.map((hs) => ({
      hallId: hs.hallId,
      hallName: hs.hallName,
      day: hs.day,
      shows: hs.shows.map((s) => ({
        id: s.id,
        movieId: s.movieId,
        movieTitle: s.movieTitle,
        movieDuration: s.movieDuration,
        adBlockMinutes: s.adBlockMinutes,
        hallId: s.hallId,
        hallName: s.hallName,
        day: s.day,
        startMinutes: s.startMinutes,
        endMinutes: s.endMinutes,
        predictedAttendance: s.predictedAttendance,
        predictedRevenue: s.predictedRevenue,
        genre: s.genre,
        ageRating: s.ageRating,
        posterUrl: s.posterUrl,
      })),
      totalRevenue: hs.totalRevenue,
      totalAttendance: hs.totalAttendance,
    })),
    totalRevenue: api.totalRevenue,
    totalAttendance: api.totalAttendance,
    totalShows: api.totalShows,
    metrics: {
      lpBound: api.metrics.lpBound,
      ipObjective: api.metrics.ipObjective,
      gapPct: api.metrics.gapPct,
      generationTimeMs: api.metrics.generationTimeMs,
      columnsGenerated: api.metrics.columnsGenerated,
    },
  };
}

// ── Сборка тела запроса ───────────────────────────────────────────────────────

function buildRequestBody(config: GenerationConfig, movies: Movie[]) {
  return {
    config: {
      scheduleName: config.scheduleName,
      days: config.days,
      halls: config.halls,
      staggerMinutes: config.staggerMinutes,
      maxColumnsPerIteration: config.maxColumnsPerIteration,
      lpTimeLimitSeconds: config.lpTimeLimitSeconds,
      childrenDaytimeOnly: config.childrenDaytimeOnly,
    },
    movies: movies
      .filter((m) => m.isActive)
      .map((m) => ({
        id: m.id,
        title: m.title,
        duration: m.duration,
        genre: m.genre,
        ageRating: m.ageRating,
        popularity: m.popularity,
        minShowsPerDay: m.minShowsPerDay,
        maxShowsPerDay: m.maxShowsPerDay,
        posterUrl: m.posterUrl,
        isActive: m.isActive,
      })),
  };
}

// ── Callbacks для WebSocket генерации ────────────────────────────────────────

export interface GenerationCallbacks {
  onStep: (steps: GenerationStep[], progress: number) => void;
  onDone: (schedule: CinemaSchedule) => void;
  onError: (message: string) => void;
}

/**
 * Генерирует расписание через WebSocket с real-time прогрессом.
 * Возвращает функцию отмены (закрывает WebSocket).
 */
export function generateScheduleViaWs(
  config: GenerationConfig,
  movies: Movie[],
  callbacks: GenerationCallbacks,
): () => void {
  const ws = new WebSocket(wsUrl());
  let closed = false;

  const initialSteps: GenerationStep[] = [
    {
      label: "Инициализация",
      description: "Подготовка данных и параметров",
      status: "pending",
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

  const steps: GenerationStep[] = initialSteps.map((s) => ({ ...s }));

  ws.onopen = () => {
    const body = buildRequestBody(config, movies);
    ws.send(JSON.stringify(body));
  };

  ws.onmessage = (event: MessageEvent) => {
    let msg: WsMessage;
    try {
      msg = JSON.parse(event.data as string) as WsMessage;
    } catch {
      return;
    }

    if (msg.type === "step") {
      const s = msg as WsStepUpdate;
      // Обновляем шаги
      for (let i = 0; i < steps.length; i++) {
        if (i < s.stepIndex) {
          steps[i].status = "completed";
        } else if (i === s.stepIndex) {
          steps[i].status = s.status;
          steps[i].label = s.label;
          steps[i].description = s.description;
        }
      }
      callbacks.onStep([...steps], s.progress);
    } else if (msg.type === "done") {
      const schedule = mapSchedule((msg as WsDone).schedule);
      callbacks.onDone(schedule);
      if (!closed) {
        ws.close();
        closed = true;
      }
    } else if (msg.type === "error") {
      callbacks.onError((msg as WsError).message);
      if (!closed) {
        ws.close();
        closed = true;
      }
    }
  };

  ws.onerror = () => {
    callbacks.onError(
      "Ошибка соединения с сервером. Проверьте, что бэкенд запущен на порту 8000.",
    );
  };

  ws.onclose = (event: CloseEvent) => {
    if (!closed && event.code !== 1000) {
      callbacks.onError(
        `WebSocket закрыт (код ${event.code}). Сервер недоступен.`,
      );
    }
    closed = true;
  };

  // Функция отмены
  return () => {
    if (!closed) {
      ws.close(1000, "cancelled");
      closed = true;
    }
  };
}

/**
 * Генерирует расписание через HTTP POST (без прогресса).
 */
export async function generateScheduleHttp(
  config: GenerationConfig,
  movies: Movie[],
): Promise<CinemaSchedule> {
  const body = buildRequestBody(config, movies);
  const response = await fetchWithAuth(
    `${API_BASE}/api/schedule/generate-full`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const data = (await response.json()) as ApiScheduleOut;
  return mapSchedule(data);
}

/**
 * Проверяет доступность бэкенда.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ── Movies CRUD ───────────────────────────────────────────────────────────────

export async function fetchMovies(): Promise<Movie[]> {
  const res = await fetchWithAuth(`${API_BASE}/api/movies`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`fetchMovies: ${res.status}`);
  return res.json() as Promise<Movie[]>;
}

export async function createMovie(data: MovieFormData): Promise<Movie> {
  const res = await fetchWithAuth(`${API_BASE}/api/movies`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`createMovie: ${res.status}`);
  return res.json() as Promise<Movie>;
}

export async function updateMovie(
  id: string,
  data: MovieFormData,
): Promise<Movie> {
  const res = await fetchWithAuth(`${API_BASE}/api/movies/${id}`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`updateMovie: ${res.status}`);
  return res.json() as Promise<Movie>;
}

export async function toggleMovieApi(id: string): Promise<Movie> {
  const res = await fetchWithAuth(`${API_BASE}/api/movies/${id}/toggle`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`toggleMovie: ${res.status}`);
  return res.json() as Promise<Movie>;
}

export async function deleteMovieApi(id: string): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/api/movies/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`deleteMovie: ${res.status}`);
}

// ── Halls CRUD ────────────────────────────────────────────────────────────────

export async function fetchHalls(): Promise<HallConfig[]> {
  const res = await fetchWithAuth(`${API_BASE}/api/halls`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`fetchHalls: ${res.status}`);
  const halls = (await res.json()) as Array<HallConfig & { enabled?: boolean }>;
  return halls.map((h) => ({ ...h, enabled: true }));
}

export async function createHallApi(
  data: Omit<HallConfig, "id" | "enabled">,
): Promise<HallConfig> {
  const res = await fetchWithAuth(`${API_BASE}/api/halls`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`createHall: ${res.status}`);
  const hall = (await res.json()) as HallConfig;
  return { ...hall, enabled: true };
}

export async function updateHallApi(
  id: string,
  data: Omit<HallConfig, "id" | "enabled">,
): Promise<HallConfig> {
  const res = await fetchWithAuth(`${API_BASE}/api/halls/${id}`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`updateHall: ${res.status}`);
  const hall = (await res.json()) as HallConfig;
  return { ...hall, enabled: true };
}

export async function deleteHallApi(id: string): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/api/halls/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`deleteHall: ${res.status}`);
}

// ── Schedules persistence ─────────────────────────────────────────────────────

export async function fetchSchedulesFromDb(): Promise<CinemaSchedule[]> {
  const res = await fetchWithAuth(`${API_BASE}/api/schedules`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`fetchSchedules: ${res.status}`);
  return res.json() as Promise<CinemaSchedule[]>;
}

export async function saveScheduleToDb(
  schedule: CinemaSchedule,
): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/api/schedules`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      id: schedule.id,
      name: schedule.name,
      createdAt: schedule.createdAt,
      days: schedule.days,
      startDate: schedule.startDate ?? null,
      endDate: schedule.endDate ?? null,
      data: schedule,
      totalRevenue: schedule.totalRevenue,
      totalAttendance: schedule.totalAttendance,
      totalShows: schedule.totalShows,
    }),
  });
  if (!res.ok) throw new Error(`saveSchedule: ${res.status}`);
}

export async function deleteScheduleFromDb(id: string): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/api/schedules/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 404)
    throw new Error(`deleteSchedule: ${res.status}`);
}

// ── Users API ─────────────────────────────────────────────────────────────────

export async function fetchUsers(): Promise<unknown[]> {
  const res = await fetchWithAuth(`${API_BASE}/api/users`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`fetchUsers: ${res.status}`);
  return res.json();
}

export async function createUserApi(data: {
  email: string;
  name: string;
  password: string;
  role: string;
  orgId?: string;
}): Promise<unknown> {
  const res = await fetchWithAuth(`${API_BASE}/api/users`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`createUser: ${res.status}`);
  return res.json();
}

export async function updateUserApi(
  id: string,
  data: {
    name: string;
    role: string;
    isActive: boolean;
    orgId?: string | null;
  },
): Promise<unknown> {
  const res = await fetchWithAuth(`${API_BASE}/api/users/${id}`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`updateUser: ${res.status}`);
  return res.json();
}

export async function deleteUserApi(id: string): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/api/users/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 404)
    throw new Error(`deleteUser: ${res.status}`);
}

// ── Organizations API ─────────────────────────────────────────────────────────

import type { Organization, OrganizationDetail } from "@/types/user";

export async function fetchOrganizations(): Promise<Organization[]> {
  const res = await fetchWithAuth(`${API_BASE}/api/organizations`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`fetchOrganizations: ${res.status}`);
  return res.json();
}

export async function fetchOrganization(
  id: string,
): Promise<OrganizationDetail> {
  const res = await fetchWithAuth(`${API_BASE}/api/organizations/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`fetchOrganization: ${res.status}`);
  return res.json();
}

export async function createOrganizationApi(data: {
  name: string;
  slug?: string;
  description?: string;
  address?: string;
  logoUrl?: string;
}): Promise<Organization> {
  const res = await fetchWithAuth(`${API_BASE}/api/organizations`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`createOrganization: ${res.status}`);
  return res.json();
}

export async function updateOrganizationApi(
  id: string,
  data: {
    name: string;
    slug?: string;
    description?: string;
    address?: string;
    logoUrl?: string;
    isActive?: boolean;
  },
): Promise<Organization> {
  const res = await fetchWithAuth(`${API_BASE}/api/organizations/${id}`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`updateOrganization: ${res.status}`);
  return res.json();
}

export async function deleteOrganizationApi(id: string): Promise<void> {
  const res = await fetchWithAuth(`${API_BASE}/api/organizations/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 404)
    throw new Error(`deleteOrganization: ${res.status}`);
}

// ── Schedule Editing API ──────────────────────────────────────────────────────

export async function patchSchedule(
  id: string,
  data: {
    name?: string;
    data?: Record<string, unknown>;
    totalRevenue?: number;
    totalAttendance?: number;
    totalShows?: number;
    startDate?: string;
    endDate?: string;
    isArchived?: boolean;
  },
): Promise<unknown> {
  const res = await fetchWithAuth(`${API_BASE}/api/schedules/${id}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`patchSchedule: ${res.status}`);
  return res.json();
}

// ── Schedule Comments API ─────────────────────────────────────────────────────

export interface ScheduleCommentItem {
  id: string;
  userName: string;
  comment: string;
  createdAt: string;
}

export interface CommentsResponse {
  totalComments: number;
  comments: ScheduleCommentItem[];
}

export async function submitComment(
  scheduleId: string,
  comment: string,
): Promise<ScheduleCommentItem> {
  const res = await fetchWithAuth(
    `${API_BASE}/api/schedules/${scheduleId}/comments`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ comment }),
    },
  );
  if (!res.ok) throw new Error(`submitComment: ${res.status}`);
  return res.json();
}

export async function fetchComments(
  scheduleId: string,
): Promise<CommentsResponse> {
  const res = await fetchWithAuth(
    `${API_BASE}/api/schedules/${scheduleId}/comments`,
    {
      headers: authHeaders(),
    },
  );
  if (!res.ok) throw new Error(`fetchComments: ${res.status}`);
  return res.json();
}

export async function deleteComment(
  scheduleId: string,
  commentId: string,
): Promise<void> {
  const res = await fetchWithAuth(
    `${API_BASE}/api/schedules/${scheduleId}/comments/${commentId}`,
    { method: "DELETE", headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`deleteComment: ${res.status}`);
}

// ── Schedule Recalculation API ────────────────────────────────────────────────

export interface RecalcShowInput {
  id: string;
  movieId: string;
  hallId: string;
  day: number;
  startMinutes: number;
  endMinutes: number;
  adBlockMinutes: number;
}

export interface RecalcShowResult {
  id: string;
  predictedAttendance: number;
  predictedRevenue: number;
}

export interface RecalcResponse {
  shows: RecalcShowResult[];
  totalAttendance: number;
  totalRevenue: number;
}

export async function recalculateSchedule(
  shows: RecalcShowInput[],
): Promise<RecalcResponse> {
  const res = await fetchWithAuth(`${API_BASE}/api/schedules/recalculate`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ shows }),
  });
  if (!res.ok) throw new Error(`recalculate: ${res.status}`);
  return res.json();
}

// ── Kinopoisk API ─────────────────────────────────────────────────────────────

export interface KpSearchResult {
  kpId: number;
  title: string;
  originalTitle: string;
  year: string;
  posterUrl: string | null;
  description: string;
  rating: number;
  genres: string[];
}

export interface KpMovieDetails {
  kpId: number;
  title: string;
  originalTitle: string;
  genre: string;
  duration: number;
  ageRating: string;
  releaseDate: string;
  posterUrl: string | null;
  description: string;
  director: string;
  popularity: number;
  ratingKp: number;
  ratingImdb: number;
}

export async function kpSearch(query: string): Promise<KpSearchResult[]> {
  const res = await fetchWithAuth(
    `${API_BASE}/api/kp/search?query=${encodeURIComponent(query)}`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`kp search: ${res.status}`);
  const data = await res.json();
  return data.results;
}

export async function kpDetails(kpId: number): Promise<KpMovieDetails> {
  const res = await fetchWithAuth(`${API_BASE}/api/kp/${kpId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`kp details: ${res.status}`);
  return res.json();
}
