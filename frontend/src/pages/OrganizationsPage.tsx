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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createOrganizationApi,
  deleteOrganizationApi,
  fetchOrganization,
  fetchOrganizations,
  updateOrganizationApi,
} from "@/services/api";
import type { Organization, OrganizationDetail } from "@/types/user";
import {
  Building2,
  CalendarDays,
  Film,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { observer } from "mobx-react";
import { useEffect, useState } from "react";

// ── Типы ─────────────────────────────────────────────────────────────────────

interface OrgForm {
  name: string;
  slug: string;
  description: string;
  address: string;
  logoUrl: string;
  isActive: boolean;
}

const EMPTY_FORM: OrgForm = {
  name: "",
  slug: "",
  description: "",
  address: "",
  logoUrl: "",
  isActive: true,
};

// ── Компонент ─────────────────────────────────────────────────────────────────

export const OrganizationsPage = observer(function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [details, setDetails] = useState<Record<string, OrganizationDetail>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [form, setForm] = useState<OrgForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Загрузка ───────────────────────────────────────────────────────────────

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrganizations();
      setOrgs(data);
      // Загрузим детали для каждой организации
      const detailsMap: Record<string, OrganizationDetail> = {};
      await Promise.all(
        data.map(async (org) => {
          try {
            detailsMap[org.id] = await fetchOrganization(org.id);
          } catch {
            // ignore
          }
        }),
      );
      setDetails(detailsMap);
    } catch {
      setError("Не удалось загрузить организации");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ── Диалог ─────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingOrg(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(org: Organization) {
    setEditingOrg(org);
    setForm({
      name: org.name,
      slug: org.slug,
      description: org.description ?? "",
      address: org.address ?? "",
      logoUrl: org.logoUrl ?? "",
      isActive: org.isActive,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    setFormError(null);
    try {
      if (editingOrg) {
        const updated = await updateOrganizationApi(editingOrg.id, {
          name: form.name,
          slug: form.slug || undefined,
          description: form.description || undefined,
          address: form.address || undefined,
          logoUrl: form.logoUrl || undefined,
          isActive: form.isActive,
        });
        setOrgs((prev) =>
          prev.map((o) => (o.id === editingOrg.id ? updated : o)),
        );
      } else {
        const created = await createOrganizationApi({
          name: form.name,
          slug: form.slug || undefined,
          description: form.description || undefined,
          address: form.address || undefined,
          logoUrl: form.logoUrl || undefined,
        });
        setOrgs((prev) => [created, ...prev]);
      }
      setDialogOpen(false);
      // Перезагружаем детали
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка сохранения";
      setFormError(msg.includes("400") ? "Такой идентификатор уже занят" : msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Удаление ───────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteOrganizationApi(deleteConfirm.id);
      setOrgs((prev) => prev.filter((o) => o.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }

  // ── Фильтрация ─────────────────────────────────────────────────────────────

  const filtered = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.slug.toLowerCase().includes(search.toLowerCase()) ||
      (o.address ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  // ── Рендер ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Заголовок */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-indigo-600 via-violet-600 to-purple-600 p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Building2 className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Организации</h1>
            </div>
            <p className="text-white/70 text-sm max-w-md">
              Управляйте сетью кинотеатров — залы, фильмы и расписания каждой
              организации
            </p>
          </div>
          <Button
            onClick={openCreate}
            size="lg"
            className="shrink-0 bg-white text-indigo-700 hover:bg-white/90 shadow-lg font-semibold h-12 px-6"
          >
            <Plus className="mr-2 h-5 w-5" />
            Добавить организацию
          </Button>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Организаций",
            value: orgs.length,
            icon: <Building2 className="h-5 w-5" />,
            color: "indigo",
          },
          {
            label: "Всего залов",
            value: Object.values(details).reduce((s, d) => s + d.hallsCount, 0),
            icon: <MapPin className="h-5 w-5" />,
            color: "violet",
          },
          {
            label: "Всего пользователей",
            value: Object.values(details).reduce((s, d) => s + d.usersCount, 0),
            icon: <Users className="h-5 w-5" />,
            color: "purple",
          },
          {
            label: "Расписаний",
            value: Object.values(details).reduce(
              (s, d) => s + d.schedulesCount,
              0,
            ),
            icon: <CalendarDays className="h-5 w-5" />,
            color: "blue",
          },
        ].map(({ label, value, icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-3"
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                color === "indigo" &&
                  "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
                color === "violet" &&
                  "bg-violet-100 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400",
                color === "purple" &&
                  "bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
                color === "blue" &&
                  "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
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
          placeholder="Поиск по названию или адресу..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Загрузка */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800/30 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Карточки организаций */}
      {!loading && !error && (
        <>
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filtered.map((org) => {
                const detail = details[org.id];
                return (
                  <div
                    key={org.id}
                    className="rounded-2xl border border-border/50 bg-card overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {/* Header gradient */}
                    <div className="h-2 bg-linear-to-r from-indigo-500 via-violet-500 to-purple-500" />

                    <div className="p-5 space-y-4">
                      {/* Название + действия */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Building2 className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg leading-tight">
                              {org.name}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {org.slug}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(org)}
                            title="Редактировать"
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:text-foreground hover:border-border/50 hover:bg-muted/50 transition-all"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(org)}
                            title="Удалить"
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:text-red-500 hover:border-red-200/50 hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Описание */}
                      {org.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {org.description}
                        </p>
                      )}

                      {/* Адрес */}
                      {org.address && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{org.address}</span>
                        </div>
                      )}

                      {/* Статистика */}
                      {detail && (
                        <div className="grid grid-cols-4 gap-3 pt-2 border-t border-border/50">
                          {[
                            {
                              icon: (
                                <MapPin className="h-3.5 w-3.5 text-violet-500" />
                              ),
                              value: detail.hallsCount,
                              label: "залов",
                            },
                            {
                              icon: (
                                <Film className="h-3.5 w-3.5 text-emerald-500" />
                              ),
                              value: detail.moviesCount,
                              label: "фильмов",
                            },
                            {
                              icon: (
                                <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
                              ),
                              value: detail.schedulesCount,
                              label: "расписаний",
                            },
                            {
                              icon: (
                                <Users className="h-3.5 w-3.5 text-orange-500" />
                              ),
                              value: detail.usersCount,
                              label: "сотрудников",
                            },
                          ].map(({ icon, value, label }) => (
                            <div
                              key={label}
                              className="flex flex-col items-center gap-1 py-2 rounded-lg bg-muted/30"
                            >
                              {icon}
                              <span className="text-lg font-bold leading-none">
                                {value}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {label}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/20 dark:to-purple-900/20 mb-5">
                <Building2 className="h-10 w-10 text-indigo-500" />
              </div>
              <h3 className="text-xl font-bold">
                {search ? "Ничего не найдено" : "Нет организаций"}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm max-w-sm">
                {search
                  ? "Попробуйте изменить запрос поиска"
                  : "Добавьте первую организацию для управления сетью кинотеатров"}
              </p>
              {!search && (
                <Button
                  onClick={openCreate}
                  className="mt-6 bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить организацию
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
              {editingOrg ? "Редактировать организацию" : "Новая организация"}
            </DialogTitle>
            <DialogDescription>
              {editingOrg
                ? "Измените данные организации"
                : "Заполните данные для создания организации"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="org-name">Название *</Label>
              <Input
                id="org-name"
                placeholder="Синема Парк Москва"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-slug">Идентификатор</Label>
              <Input
                id="org-slug"
                placeholder="cinema-park-moscow (авто)"
                value={form.slug}
                onChange={(e) =>
                  setForm((p) => ({ ...p, slug: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Уникальный идентификатор. Если не указан — сгенерируется
                автоматически.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-address">Адрес</Label>
              <Input
                id="org-address"
                placeholder="Москва, ул. Охотный Ряд, д. 2"
                value={form.address}
                onChange={(e) =>
                  setForm((p) => ({ ...p, address: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-desc">Описание</Label>
              <Textarea
                id="org-desc"
                placeholder="Описание организации..."
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                rows={3}
              />
            </div>

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
                className="bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                {saving
                  ? "Сохранение..."
                  : editingOrg
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
            <DialogTitle>Удалить организацию?</DialogTitle>
            <DialogDescription>
              Организация{" "}
              <span className="font-medium text-foreground">
                {deleteConfirm?.name}
              </span>{" "}
              будет удалена. Все связанные залы и пользователи останутся без
              привязки.
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
