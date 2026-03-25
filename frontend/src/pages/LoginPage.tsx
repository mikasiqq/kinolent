import { useState } from "react";
import { observer } from "mobx-react";
import { Clapperboard, Eye, EyeOff, LogIn } from "lucide-react";
import { authStore } from "@/stores/authStore";

export const LoginPage = observer(function LoginPage() {
  const [email, setEmail] = useState("admin@kinolent.ru");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    try {
      await authStore.login(email, password);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Ошибка входа");
    }
  }

  const error = localError ?? authStore.error;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Фоновый градиент */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-150 h-150 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-100 h-100 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Логотип */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Clapperboard className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold bg-linear-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              Кинолент
            </span>
          </div>
          <p className="text-muted-foreground text-sm">Генератор расписания кинотеатра</p>
        </div>

        {/* Карточка */}
        <div className="bg-card border border-border/50 rounded-2xl p-8 shadow-2xl shadow-black/20">
          <h1 className="text-xl font-semibold text-foreground mb-1">Вход в систему</h1>
          <p className="text-sm text-muted-foreground mb-6">Введите ваши учётные данные</p>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="admin@kinolent.ru"
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border/60 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-all text-sm"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Пароль</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-background border border-border/60 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Ошибка */}
            {error && (
              <div className="px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Кнопка */}
            <button
              type="submit"
              disabled={authStore.isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-medium text-sm shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authStore.isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {authStore.isLoading ? "Вход..." : "Войти"}
            </button>
          </form>

          {/* Подсказка */}
          <div className="mt-5 pt-5 border-t border-border/40">
            <p className="text-xs text-muted-foreground/60 text-center">
              По умолчанию: <span className="text-muted-foreground">admin@kinolent.ru</span> / <span className="text-muted-foreground">admin123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
