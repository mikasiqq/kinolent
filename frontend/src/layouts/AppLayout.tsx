import { cn } from "@/lib/utils";
import { authStore } from "@/stores/authStore";
import { ROLE_COLORS, ROLE_LABELS } from "@/types/user";
import {
  CalendarDays,
  Clapperboard,
  Film,
  LayoutDashboard,
  LogOut,
  Menu,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { observer } from "mobx-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

const BASE_NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Дашборд" },
  { to: "/movies", icon: Film, label: "Фильмы" },
  { to: "/schedule", icon: CalendarDays, label: "Расписание" },
  { to: "/generate", icon: Sparkles, label: "Генерация" },
];

const ADMIN_NAV_ITEMS = [
  { to: "/users", icon: Users, label: "Пользователи" },
];

export const AppLayout = observer(function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(authStore.can("admin") ? ADMIN_NAV_ITEMS : []),
  ];

  function handleLogout() {
    authStore.logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Хедер */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* Логотип */}
          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/20 transition-transform duration-300 group-hover:scale-110">
              <Clapperboard className="h-5 w-5 text-white" />
              <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight tracking-tight bg-linear-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                Кинолент
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight hidden sm:block">
                Генератор расписания
              </span>
            </div>
          </NavLink>

          {/* Навигация десктоп */}
          <nav className="hidden md:flex items-center gap-1 rounded-2xl border border-border/50 bg-muted/30 p-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Правая часть: профиль + выход */}
          <div className="hidden md:flex items-center gap-3">
            {authStore.user && (
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground leading-none">
                    {authStore.user.name}
                  </p>
                  <p
                    className={cn(
                      "text-xs leading-none mt-0.5",
                      ROLE_COLORS[authStore.user.role],
                    )}
                  >
                    {ROLE_LABELS[authStore.user.role]}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  title="Выйти"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-muted/30 text-muted-foreground hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/10 transition-all"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Кнопка мобильного меню */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Мобильное меню */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl">
            <nav className="container mx-auto flex flex-col gap-1 px-4 py-3">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                      isActive
                        ? "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Контент */}
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
});
