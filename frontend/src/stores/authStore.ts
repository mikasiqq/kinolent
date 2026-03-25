import { makeAutoObservable, runInAction } from "mobx";
import type { User, UserRole } from "@/types/user";

const ACCESS_KEY = "kinolent_access_token";
const REFRESH_KEY = "kinolent_refresh_token";

const API_BASE =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ??
  "http://localhost:8000";

class AuthStore {
  user: User | null = null;
  isLoading = false;
  isInitialized = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  get isAuthenticated(): boolean {
    return this.user !== null;
  }

  get role(): UserRole | null {
    return this.user?.role ?? null;
  }

  /** Проверяет, есть ли у пользователя нужная роль */
  can(action: "view" | "manage" | "admin"): boolean {
    if (!this.user) return false;
    if (action === "view") return true; // все авторизованные
    if (action === "manage") return this.user.role === "admin" || this.user.role === "manager";
    if (action === "admin") return this.user.role === "admin";
    return false;
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  private _saveTokens(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  }

  private _clearTokens() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  /** Попытка восстановить сессию по токену из localStorage */
  async init() {
    const token = this.getAccessToken();
    if (!token) {
      runInAction(() => { this.isInitialized = true; });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = (await res.json()) as User;
        runInAction(() => {
          this.user = user;
          this.isInitialized = true;
        });
      } else {
        // Пробуем refresh
        await this._tryRefresh();
        runInAction(() => { this.isInitialized = true; });
      }
    } catch {
      runInAction(() => { this.isInitialized = true; });
    }
  }

  private async _tryRefresh(): Promise<boolean> {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) { this._clearTokens(); return false; }
      const tokens = (await res.json()) as { accessToken: string; refreshToken: string };
      this._saveTokens(tokens.accessToken, tokens.refreshToken);
      // Fetch user info
      const meRes = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (meRes.ok) {
        const user = (await meRes.json()) as User;
        runInAction(() => { this.user = user; });
        return true;
      }
    } catch { /* ignore */ }
    this._clearTokens();
    return false;
  }

  async login(email: string, password: string): Promise<void> {
    this.isLoading = true;
    this.error = null;
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { detail?: string };
        throw new Error(data.detail ?? "Ошибка входа");
      }
      const tokens = (await res.json()) as { accessToken: string; refreshToken: string };
      this._saveTokens(tokens.accessToken, tokens.refreshToken);

      const meRes = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      const user = (await meRes.json()) as User;
      runInAction(() => {
        this.user = user;
        this.isLoading = false;
      });
    } catch (e) {
      runInAction(() => {
        this.error = e instanceof Error ? e.message : "Ошибка входа";
        this.isLoading = false;
      });
      throw e;
    }
  }

  logout() {
    this._clearTokens();
    runInAction(() => { this.user = null; });
    // Опционально: вызвать /api/auth/logout
    fetch(`${API_BASE}/api/auth/logout`, { method: "POST" }).catch(() => {});
  }
}

export const authStore = new AuthStore();
