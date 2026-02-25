import { observer } from "mobx-react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Settings2,
  Play,
  CheckCircle2,
  Circle,
  Loader2,
  ArrowLeft,
  CalendarDays,
  Users,
  DollarSign,
  Zap,
  Timer,
  XCircle,
  RotateCcw,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { scheduleStore } from "@/stores/scheduleStore";
import { movieStore } from "@/stores/movieStore";
import { HALL_TYPE_LABELS } from "@/types/schedule";
import { cn } from "@/lib/utils";

export const GenerateSchedulePage = observer(function GenerateSchedulePage() {
  const navigate = useNavigate();
  const { generationStatus, generationProgress, generationSteps, config } =
    scheduleStore;

  const activeMovies = movieStore.movies.filter((m) => m.isActive);
  const enabledHalls = config.halls.filter((h) => h.enabled);
  const canGenerate = activeMovies.length > 0 && enabledHalls.length > 0;

  const handleGenerate = async () => {
    await scheduleStore.generateSchedule();
  };

  const handleViewSchedule = () => {
    navigate("/schedule");
  };

  return (
    <div className="space-y-8">
      {/* Заголовок с градиентом */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 text-white shadow-xl">
        {/* Декоративные элементы */}
        <div className="absolute top-0 right-0 -mt-6 -mr-6 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute top-1/2 right-1/4 h-20 w-20 rounded-full bg-violet-300/20 blur-xl" />
        <div className="absolute bottom-4 right-8 opacity-5">
          <Cpu className="h-32 w-32" />
        </div>

        <div className="relative flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0 text-white/80 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Sparkles className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Генерация расписания
              </h1>
            </div>
            <p className="text-white/70 text-sm ml-13">
              Настройте параметры и запустите автоматическую генерацию
            </p>
          </div>
        </div>
      </div>

      {generationStatus === "generating" ? (
        <GeneratingView progress={generationProgress} steps={generationSteps} />
      ) : generationStatus === "completed" ? (
        <CompletedView
          onView={handleViewSchedule}
          onReset={() => scheduleStore.resetGeneration()}
        />
      ) : generationStatus === "error" ? (
        <ErrorView
          onRetry={handleGenerate}
          onReset={() => scheduleStore.resetGeneration()}
        />
      ) : (
        <ConfigurationView
          canGenerate={canGenerate}
          activeMoviesCount={activeMovies.length}
          enabledHallsCount={enabledHalls.length}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  );
});

/** Вид конфигурации */
const ConfigurationView = observer(function ConfigurationView({
  canGenerate,
  activeMoviesCount,
  enabledHallsCount,
  onGenerate,
}: {
  canGenerate: boolean;
  activeMoviesCount: number;
  enabledHallsCount: number;
  onGenerate: () => void;
}) {
  const { config } = scheduleStore;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Левая колонка — основные настройки */}
      <div className="lg:col-span-2 space-y-6">
        {/* Основные параметры */}
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="border-b border-border/50 px-6 py-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Settings2 className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h3 className="font-bold">Параметры расписания</h3>
              <p className="text-xs text-muted-foreground">
                Основные настройки для генерации
              </p>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduleName">Название</Label>
                <Input
                  id="scheduleName"
                  value={config.scheduleName}
                  onChange={(e) =>
                    scheduleStore.updateConfig({
                      scheduleName: e.target.value,
                    })
                  }
                  placeholder="Расписание на неделю"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="days">Количество дней</Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  max={14}
                  value={config.days}
                  onChange={(e) =>
                    scheduleStore.updateConfig({
                      days: Number(e.target.value),
                    })
                  }
                  className="rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stagger">Интервал сдвига (мин)</Label>
                <Input
                  id="stagger"
                  type="number"
                  min={0}
                  max={30}
                  value={config.staggerMinutes}
                  onChange={(e) =>
                    scheduleStore.updateConfig({
                      staggerMinutes: Number(e.target.value),
                    })
                  }
                  className="rounded-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Сдвиг начала сеансов между залами
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lpTimeLimit">Лимит LP-решателя (сек)</Label>
                <Input
                  id="lpTimeLimit"
                  type="number"
                  min={5}
                  max={300}
                  value={config.lpTimeLimitSeconds}
                  onChange={(e) =>
                    scheduleStore.updateConfig({
                      lpTimeLimitSeconds: Number(e.target.value),
                    })
                  }
                  className="rounded-lg"
                />
              </div>
            </div>

            {/* Переключатели */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-4 transition-colors hover:bg-muted/40">
                <div>
                  <p className="text-sm font-medium">Anti-crowding</p>
                  <p className="text-xs text-muted-foreground">
                    Распределение зрителей по этажам
                  </p>
                </div>
                <Switch
                  checked={config.antiCrowding}
                  onCheckedChange={(v) =>
                    scheduleStore.updateConfig({ antiCrowding: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-4 transition-colors hover:bg-muted/40">
                <div>
                  <p className="text-sm font-medium">
                    Детские фильмы — только днём
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ограничение показа детских фильмов вечером
                  </p>
                </div>
                <Switch
                  checked={config.childrenDaytimeOnly}
                  onCheckedChange={(v) =>
                    scheduleStore.updateConfig({
                      childrenDaytimeOnly: v,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Залы */}
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="border-b border-border/50 px-6 py-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 text-xl">
              🏛️
            </div>
            <div>
              <h3 className="font-bold">Залы кинотеатра</h3>
              <p className="text-xs text-muted-foreground">
                Включите залы, которые участвуют в расписании
              </p>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {config.halls.map((hall) => (
                <button
                  key={hall.id}
                  onClick={() => scheduleStore.toggleHall(hall.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer",
                    hall.enabled
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                      : "border-border hover:border-muted-foreground/30 opacity-60",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      hall.enabled
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {hall.enabled && (
                      <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{hall.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {HALL_TYPE_LABELS[hall.hallType]}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {hall.capacity} мест
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {hall.openTime}—{hall.closeTime}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Правая колонка — сводка и запуск */}
      <div className="space-y-6">
        {/* Сводка */}
        <div className="sticky top-24 rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="border-b border-border/50 px-6 py-4">
            <h3 className="font-bold text-lg">Сводка</h3>
          </div>
          <div className="p-6 space-y-4">
            {/* Фильмы */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 text-lg">
                  🎬
                </div>
                <span className="font-medium">Фильмов</span>
              </div>
              <Badge
                variant={activeMoviesCount > 0 ? "default" : "destructive"}
                className="rounded-lg h-7 px-3"
              >
                {activeMoviesCount}
              </Badge>
            </div>

            {/* Залы */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-lg">
                  🏛️
                </div>
                <span className="font-medium">Залов</span>
              </div>
              <Badge
                variant={enabledHallsCount > 0 ? "default" : "destructive"}
                className="rounded-lg h-7 px-3"
              >
                {enabledHallsCount}
              </Badge>
            </div>

            {/* Дней */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30 text-lg">
                  📅
                </div>
                <span className="font-medium">Дней</span>
              </div>
              <Badge className="rounded-lg h-7 px-3">{config.days}</Badge>
            </div>

            <div className="border-t border-border/50 pt-4">
              <div className="text-xs text-muted-foreground space-y-2">
                <div className="flex justify-between">
                  <span>Макс. столбцов/итерацию</span>
                  <span className="font-medium text-foreground">
                    {config.maxColumnsPerIteration}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Интервал сдвига</span>
                  <span className="font-medium text-foreground">
                    {config.staggerMinutes} мин
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Anti-crowding</span>
                  <span
                    className={cn(
                      "font-medium",
                      config.antiCrowding
                        ? "text-emerald-600"
                        : "text-muted-foreground",
                    )}
                  >
                    {config.antiCrowding ? "Вкл" : "Выкл"}
                  </span>
                </div>
              </div>
            </div>

            {/* Кнопка запуска */}
            <Button
              size="lg"
              className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/25 text-base h-12 rounded-xl"
              disabled={!canGenerate}
              onClick={onGenerate}
            >
              <Play className="mr-2 h-5 w-5" />
              Запустить генерацию
            </Button>

            {!canGenerate && (
              <p className="text-xs text-destructive text-center">
                {activeMoviesCount === 0
                  ? "Добавьте активные фильмы"
                  : "Включите хотя бы один зал"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

/** Вид процесса генерации */
function GeneratingView({
  progress,
  steps,
}: {
  progress: number;
  steps: { label: string; description: string; status: string }[];
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      {/* Анимированная иконка */}
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-6">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-linear-to-br from-violet-100 to-indigo-100 dark:from-violet-900/20 dark:to-indigo-900/20">
            <Loader2 className="h-14 w-14 text-violet-500 animate-spin" />
          </div>
          <div className="absolute inset-0 rounded-full bg-violet-400/20 animate-ping" />
        </div>
        <h2 className="text-2xl font-bold">Генерация расписания</h2>
        <p className="text-muted-foreground mt-1">
          Column Generation алгоритм работает...
        </p>
      </div>

      {/* Прогресс-бар */}
      <div className="space-y-2 rounded-xl border border-border/50 bg-card p-5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Прогресс</span>
          <span className="font-bold text-violet-600">
            {Math.round(progress)}%
          </span>
        </div>
        <Progress value={progress} className="h-3" />
      </div>

      {/* Шаги */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="p-6">
          <div className="space-y-5">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="mt-0.5">
                  {step.status === "completed" ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                  ) : step.status === "active" ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
                      <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/50">
                      <Circle className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      step.status === "pending"
                        ? "text-muted-foreground/50"
                        : step.status === "active"
                          ? "text-violet-600"
                          : "",
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Вид завершения */
function CompletedView({
  onView,
  onReset,
}: {
  onView: () => void;
  onReset: () => void;
}) {
  const schedule = scheduleStore.currentSchedule;
  if (!schedule) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      {/* Успех */}
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-6">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-linear-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">Расписание готово!</h2>
        <p className="text-muted-foreground mt-1">
          Оптимальное расписание успешно сгенерировано
        </p>
      </div>

      {/* Результаты */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-5 text-center">
          <CalendarDays className="h-7 w-7 mx-auto text-blue-500 mb-2" />
          <p className="text-3xl font-bold">{schedule.totalShows}</p>
          <p className="text-xs text-muted-foreground mt-1">сеансов</p>
        </div>
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-5 text-center">
          <Users className="h-7 w-7 mx-auto text-emerald-500 mb-2" />
          <p className="text-3xl font-bold">
            {(schedule.totalAttendance / 1000).toFixed(1)}K
          </p>
          <p className="text-xs text-muted-foreground mt-1">зрителей</p>
        </div>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-5 text-center">
          <DollarSign className="h-7 w-7 mx-auto text-amber-500 mb-2" />
          <p className="text-3xl font-bold">
            {(schedule.totalRevenue / 1_000_000).toFixed(1)}M
          </p>
          <p className="text-xs text-muted-foreground mt-1">₽ выручка</p>
        </div>
        <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 p-5 text-center">
          <Zap className="h-7 w-7 mx-auto text-violet-500 mb-2" />
          <p className="text-3xl font-bold">
            {schedule.metrics.gapPct.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">gap</p>
        </div>
      </div>

      {/* Метрики оптимизации */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="border-b border-border/50 px-6 py-4 flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-bold">Метрики оптимизации</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">LP-граница</span>
              <span className="font-mono font-medium">
                {(schedule.metrics.lpBound / 1_000_000).toFixed(2)}M ₽
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IP-решение</span>
              <span className="font-mono font-medium">
                {(schedule.metrics.ipObjective / 1_000_000).toFixed(2)}M ₽
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Время генерации</span>
              <span className="font-mono font-medium">
                {(schedule.metrics.generationTimeMs / 1000).toFixed(1)}с
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Столбцов создано</span>
              <span className="font-mono font-medium">
                {schedule.metrics.columnsGenerated}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Действия */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          size="lg"
          onClick={onView}
          className="bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 h-12 px-8 rounded-xl shadow-lg"
        >
          <CalendarDays className="mr-2 h-5 w-5" />
          Перейти к расписанию
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={onReset}
          className="h-12 px-8 rounded-xl"
        >
          <RotateCcw className="mr-2 h-5 w-5" />
          Сгенерировать ещё
        </Button>
      </div>
    </div>
  );
}

/** Вид ошибки */
function ErrorView({
  onRetry,
  onReset,
}: {
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <div className="max-w-md mx-auto flex flex-col items-center text-center py-20">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 mb-6">
        <XCircle className="h-12 w-12 text-red-500" />
      </div>
      <h3 className="text-xl font-bold">Ошибка генерации</h3>
      <p className="text-muted-foreground mt-2 text-sm">
        Произошла ошибка при генерации расписания. Попробуйте ещё раз.
      </p>
      <div className="flex gap-3 mt-8">
        <Button onClick={onRetry} className="rounded-xl h-11 px-6">
          <RotateCcw className="mr-2 h-4 w-4" />
          Повторить
        </Button>
        <Button
          variant="outline"
          onClick={onReset}
          className="rounded-xl h-11 px-6"
        >
          Назад к настройкам
        </Button>
      </div>
    </div>
  );
}
