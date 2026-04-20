import { HallFormDialog } from "@/components/halls/HallFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authStore } from "@/stores/authStore";
import { hallStore } from "@/stores/hallStore";
import type { HallConfig, HallType } from "@/types/schedule";
import {
  DoorOpen,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { observer } from "mobx-react";
import { useCallback, useEffect, useState } from "react";

const HALL_TYPE_LABELS: Record<HallType, string> = {
  "2D": "2D",
  "3D": "3D",
  IMAX: "IMAX",
  DOLBY_ATMOS: "Dolby Atmos",
  VIP: "VIP",
};

const HALL_TYPE_COLORS: Record<HallType, string> = {
  "2D": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "3D": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  IMAX: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  DOLBY_ATMOS:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  VIP: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

export const HallsPage = observer(function HallsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHall, setEditingHall] = useState<HallConfig | null>(null);

  useEffect(() => {
    hallStore.fetchHalls();
  }, []);

  const canManage = authStore.can("manage");

  const handleAdd = useCallback(() => {
    setEditingHall(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((hall: HallConfig) => {
    setEditingHall(hall);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(async (hall: HallConfig) => {
    if (!confirm(`Удалить зал «${hall.name}»?`)) return;
    try {
      await hallStore.deleteHall(hall.id);
    } catch (e) {
      console.error("Delete hall failed:", e);
    }
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingHall(null);
  }, []);

  return (
    <div className="space-y-8">
      {/* Заголовок */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-teal-600 via-cyan-600 to-blue-700 p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <DoorOpen className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Кинозалы</h1>
            </div>
            <p className="text-white/70 text-sm max-w-md">
              Управляйте залами кинотеатра — задавайте вместимость, тип, время
              работы и параметры уборки
            </p>
          </div>
          {canManage && (
            <Button
              onClick={handleAdd}
              size="lg"
              className="shrink-0 bg-white text-teal-700 hover:bg-white/90 shadow-lg font-semibold h-12 px-6"
            >
              <Plus className="mr-2 h-5 w-5" />
              Добавить зал
            </Button>
          )}
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Всего залов" value={hallStore.totalCount} />
        <StatCard label="Общая вместимость" value={hallStore.totalCapacity} />
        <StatCard
          label="Типов залов"
          value={new Set(hallStore.halls.map((h) => h.hallType)).size}
        />
        <StatCard
          label="Ср. вместимость"
          value={
            hallStore.totalCount
              ? Math.round(hallStore.totalCapacity / hallStore.totalCount)
              : 0
          }
        />
      </div>

      {/* Фильтры */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию…"
            className="pl-9"
            value={hallStore.filters.search}
            onChange={(e) => hallStore.setSearch(e.target.value)}
          />
        </div>
        <Select
          value={hallStore.filters.hallType}
          onValueChange={(v) => hallStore.setTypeFilter(v as HallType | "all")}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Тип зала" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            {(Object.keys(HALL_TYPE_LABELS) as HallType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {HALL_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Таблица */}
      {hallStore.filteredHalls.length > 0 ? (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground">
                <th className="text-left px-4 py-3 font-medium">Название</th>
                <th className="text-left px-4 py-3 font-medium">Тип</th>
                <th className="text-right px-4 py-3 font-medium">
                  Вместимость
                </th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
                  Уборка
                </th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">
                  Время работы
                </th>
                {canManage && (
                  <th className="text-right px-4 py-3 font-medium">Действия</th>
                )}
              </tr>
            </thead>
            <tbody>
              {hallStore.filteredHalls.map((hall) => (
                <tr
                  key={hall.id}
                  className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{hall.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${HALL_TYPE_COLORS[hall.hallType]}`}
                    >
                      {HALL_TYPE_LABELS[hall.hallType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {hall.capacity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    {hall.cleaningMinutes} мин
                  </td>
                  <td className="px-4 py-3 text-center hidden md:table-cell font-mono text-xs">
                    {hall.openTime} — {hall.closeTime}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(hall)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => handleDelete(hall)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="relative mb-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-teal-100 to-cyan-100 dark:from-teal-900/20 dark:to-cyan-900/20">
              <DoorOpen className="h-12 w-12 text-teal-500" />
            </div>
            <div className="absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
          </div>
          <h3 className="text-xl font-bold">Залы не найдены</h3>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            {hallStore.totalCount === 0
              ? "Добавьте первый зал, чтобы начать формировать расписание"
              : "Попробуйте изменить параметры фильтрации"}
          </p>
          {hallStore.totalCount === 0 && canManage && (
            <Button
              onClick={handleAdd}
              className="mt-6 bg-linear-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              Добавить зал
            </Button>
          )}
        </div>
      )}

      {/* Диалог */}
      <HallFormDialog
        key={editingHall?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        hall={editingHall}
      />
    </div>
  );
});

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
