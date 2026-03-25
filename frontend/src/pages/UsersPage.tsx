import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createUserApi,
  deleteUserApi,
  fetchUsers,
  updateUserApi,
} from "@/services/api";
import { authStore } from "@/stores/authStore";
import type { UserRole } from "@/types/user";
import { ROLE_LABELS } from "@/types/user";
import {
  CircleCheck,
  CircleMinus,
  Eye,
  Pencil,
  Search,
  Settings2,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { observer } from "mobx-react";
import { useEffect, useState } from "react";

// ── Типы ─────────────────────────────────────────────────────────────────────

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

interface UserForm {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  isActive: boolean;
}

const EMPTY_FORM: UserForm = {
  email: "",
  name: "",
  password: "",
  role: "viewer",
  isActive: true,
};

// ── Утилиты ───────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<UserRole, string> = {
  admin:
    "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/40",
  manager:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/40",
  viewer:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/40",
};

const ROLE_ICON: Record<UserRole, React.ReactNode> = {
  admin: <Shield className="h-3.5 w-3.5" />,
  manager: <Settings2 className="h-3.5 w-3.5" />,
  viewer: <Eye className="h-3.5 w-3.5" />,
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Компонент ─────────────────────────────────────────────────────────────────

export const UsersPage = observer(function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Загрузка ───────────────────────────────────────────────────────────────

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers();
      setUsers(data as UserRecord[]);
    } catch {
      setError("Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ── Диалог создания / редактирования ──────────────────────────────────────

  function openCreate() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(user: UserRecord) {
    setEditingUser(user);
    setForm({
      email: user.email,
      name: user.name,
      password: "",
      role: user.role,
      isActive: user.isActive,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    if (!editingUser && !form.password.trim()) {
      setFormError("Введите пароль");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (editingUser) {
        const updated = await updateUserApi(editingUser.id, {
          name: form.name,
          role: form.role,
          isActive: form.isActive,
        });
        setUsers((prev) =>
          prev.map((u) =>
            u.id === editingUser.id ? (updated as UserRecord) : u,
          ),
        );
      } else {
        const created = await createUserApi({
          email: form.email,
          name: form.name,
          password: form.password,
          role: form.role,
        });
        setUsers((prev) => [...prev, created as UserRecord]);
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка сохранения";
      setFormError(msg.includes("400") ? "Email уже занят" : msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Удаление ───────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteUserApi(deleteConfirm.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }

  // ── Фильтрация ─────────────────────────────────────────────────────────────

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  // ── Статистика ─────────────────────────────────────────────────────────────

  const countByRole = (role: UserRole) =>
    users.filter((u) => u.role === role).length;

  // ── Рендер ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Заголовок */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-rose-600 via-pink-600 to-orange-600 p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute top-1/2 right-1/4 h-20 w-20 rounded-full bg-orange-400/20 blur-xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Users className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Пользователи
              </h1>
            </div>
            <p className="text-white/70 text-sm max-w-md">
              Управляйте аккаунтами и правами доступа сотрудников кинотеатра
            </p>
          </div>
          <Button
            onClick={openCreate}
            size="lg"
            className="shrink-0 bg-white text-rose-700 hover:bg-white/90 shadow-lg font-semibold h-12 px-6"
          >
            <UserPlus className="mr-2 h-5 w-5" />
            Добавить пользователя
          </Button>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Всего",
            value: users.length,
            icon: <Users className="h-5 w-5" />,
            color: "rose",
          },
          {
            label: ROLE_LABELS.admin,
            value: countByRole("admin"),
            icon: <Shield className="h-5 w-5" />,
            color: "red",
          },
          {
            label: ROLE_LABELS.manager,
            value: countByRole("manager"),
            icon: <Settings2 className="h-5 w-5" />,
            color: "blue",
          },
          {
            label: ROLE_LABELS.viewer,
            value: countByRole("viewer"),
            icon: <Eye className="h-5 w-5" />,
            color: "slate",
          },
        ].map(({ label, value, icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-3"
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                color === "rose" &&
                  "bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
                color === "red" &&
                  "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400",
                color === "blue" &&
                  "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
                color === "slate" &&
                  "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400",
              )}
            >
              {icon}
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Поиск */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Поиск по имени или email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Состояние загрузки */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800/30 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Таблица пользователей */}
      {!loading && !error && (
        <>
          {filtered.length > 0 ? (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              {/* Заголовок таблицы */}
              <div className="hidden sm:grid grid-cols-[1fr_1.5fr_120px_100px_120px_88px] gap-4 px-5 py-3 bg-muted/30 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>Имя</span>
                <span>Email</span>
                <span>Роль</span>
                <span>Статус</span>
                <span>Создан</span>
                <span />
              </div>

              {/* Строки */}
              <div className="divide-y divide-border/40">
                {filtered.map((user) => {
                  const isSelf = authStore.user?.id === user.id;
                  return (
                    <div
                      key={user.id}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_120px_100px_120px_88px] gap-3 sm:gap-4 px-5 py-4 items-center hover:bg-muted/20 transition-colors group"
                    >
                      {/* Имя */}
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-linear-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center shrink-0 text-sm font-semibold text-rose-700 dark:text-rose-400">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {user.name}
                            {isSelf && (
                              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                                (вы)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Email */}
                      <p className="text-sm text-muted-foreground truncate">
                        {user.email}
                      </p>

                      {/* Роль */}
                      <div>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            ROLE_BADGE[user.role],
                          )}
                        >
                          {ROLE_ICON[user.role]}
                          {ROLE_LABELS[user.role]}
                        </span>
                      </div>

                      {/* Статус */}
                      <div className="flex items-center gap-1.5">
                        {user.isActive ? (
                          <>
                            <CircleCheck className="h-4 w-4 text-emerald-500" />
                            <span className="text-xs text-emerald-600 dark:text-emerald-400">
                              Активен
                            </span>
                          </>
                        ) : (
                          <>
                            <CircleMinus className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              Заблокирован
                            </span>
                          </>
                        )}
                      </div>

                      {/* Дата */}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </p>

                      {/* Действия */}
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(user)}
                          title="Редактировать"
                          className="h-8 w-8 flex items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:text-foreground hover:border-border/50 hover:bg-muted/50 transition-all"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => !isSelf && setDeleteConfirm(user)}
                          title={isSelf ? "Нельзя удалить себя" : "Удалить"}
                          disabled={isSelf}
                          className="h-8 w-8 flex items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:text-red-500 hover:border-red-200/50 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Пустое состояние */
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-rose-100 to-orange-100 dark:from-rose-900/20 dark:to-orange-900/20 mb-5">
                <Users className="h-10 w-10 text-rose-500" />
              </div>
              <h3 className="text-xl font-bold">
                {search ? "Никого не найдено" : "Нет пользователей"}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm max-w-sm">
                {search
                  ? "Попробуйте изменить запрос поиска"
                  : "Добавьте первого пользователя"}
              </p>
              {!search && (
                <Button
                  onClick={openCreate}
                  className="mt-6 bg-linear-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Добавить пользователя
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* Диалог создания / редактирования */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser
                ? "Редактировать пользователя"
                : "Новый пользователь"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Измените данные аккаунта"
                : "Заполните данные для создания аккаунта"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-1">
            {/* Имя */}
            <div className="space-y-2">
              <Label htmlFor="u-name">Имя *</Label>
              <Input
                id="u-name"
                placeholder="Иван Иванов"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="u-email">Email *</Label>
              <Input
                id="u-email"
                type="email"
                placeholder="user@kinolent.ru"
                value={form.email}
                disabled={!!editingUser}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                required
              />
              {editingUser && (
                <p className="text-xs text-muted-foreground">
                  Email изменить нельзя
                </p>
              )}
            </div>

            {/* Пароль (только при создании) */}
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="u-pass">Пароль *</Label>
                <Input
                  id="u-pass"
                  type="password"
                  placeholder="Минимум 6 символов"
                  value={form.password}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, password: e.target.value }))
                  }
                  required
                />
              </div>
            )}

            {/* Роль */}
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, role: v as UserRole }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-rose-500" />
                      Администратор
                    </span>
                  </SelectItem>
                  <SelectItem value="manager">
                    <span className="flex items-center gap-2">
                      <Settings2 className="h-3.5 w-3.5 text-blue-500" />
                      Менеджер
                    </span>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <span className="flex items-center gap-2">
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                      Оператор
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.role === "admin" &&
                  "Полный доступ: управление пользователями и данными"}
                {form.role === "manager" &&
                  "Управление фильмами, залами и расписаниями"}
                {form.role === "viewer" &&
                  "Только просмотр расписания и каталога"}
              </p>
            </div>

            {/* Статус (только при редактировании) */}
            {editingUser && (
              <div className="space-y-2">
                <Label>Статус</Label>
                <Select
                  value={form.isActive ? "active" : "inactive"}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, isActive: v === "active" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <span className="flex items-center gap-2">
                        <CircleCheck className="h-3.5 w-3.5 text-emerald-500" />
                        Активен
                      </span>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <span className="flex items-center gap-2">
                        <CircleMinus className="h-3.5 w-3.5 text-muted-foreground" />
                        Заблокирован
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {formError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-linear-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700"
              >
                {saving
                  ? "Сохранение..."
                  : editingUser
                    ? "Сохранить"
                    : "Создать"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить пользователя?</DialogTitle>
            <DialogDescription>
              Аккаунт{" "}
              <span className="font-medium text-foreground">
                {deleteConfirm?.name}
              </span>{" "}
              ({deleteConfirm?.email}) будет удалён безвозвратно.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
