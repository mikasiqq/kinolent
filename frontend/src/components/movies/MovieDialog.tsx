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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { KpSearchResult } from "@/services/api";
import { kpDetails, kpSearch } from "@/services/api";
import { movieStore } from "@/stores/movieStore";
import type { AgeRating, Genre, Movie, MovieFormData } from "@/types/movie";
import { AGE_RATING_OPTIONS, GENRE_LABELS } from "@/types/movie";
import {
  BookOpen,
  Globe,
  HelpCircle,
  Loader2,
  Search,
  Star,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

// ── Гайд по популярности ────────────────────────────────────────────────────

const POPULARITY_GUIDE: {
  range: [number, number];
  label: string;
  emoji: string;
  color: string;
  description: string;
  examples: string;
}[] = [
  {
    range: [9, 10],
    label: "Блокбастер",
    emoji: "🔥",
    color: "text-red-500",
    description:
      "Огромный зрительский интерес, масштабный маркетинг, премьерная неделя",
    examples: "Marvel/DC франшизы, сиквелы хитов, сборы >$100M в первую неделю",
  },
  {
    range: [7, 8],
    label: "Сильный фильм",
    emoji: "⭐",
    color: "text-amber-500",
    description:
      "Высокая узнаваемость, хороший маркетинг, ожидаемый широкой аудиторией",
    examples:
      "Оскаровские номинанты, популярные комедии, известный режиссёр + звёздный каст",
  },
  {
    range: [5, 6],
    label: "Средний фильм",
    emoji: "📽️",
    color: "text-blue-500",
    description:
      "Стандартный релиз, умеренный интерес, хорошие отзывы без ажиотажа",
    examples: "Обычные релизы, фильмы со средним бюджетом, ремейки",
  },
  {
    range: [3, 4],
    label: "Нишевый фильм",
    emoji: "🎭",
    color: "text-violet-500",
    description:
      "Ограниченная аудитория, слабый маркетинг, специфическая тематика",
    examples:
      "Артхаус, авторское кино, документалки, иностранные фильмы без дубляжа",
  },
  {
    range: [1, 2],
    label: "Минимальный интерес",
    emoji: "📉",
    color: "text-gray-400",
    description: "Очень низкий зрительский интерес, окончание проката",
    examples: "Фильмы в конце проката, малоизвестные ленты, повторный показ",
  },
];

function getPopularityInfo(value: number) {
  return (
    POPULARITY_GUIDE.find((g) => value >= g.range[0] && value <= g.range[1]) ??
    POPULARITY_GUIDE[POPULARITY_GUIDE.length - 1]
  );
}

/** Мини-гайд под слайдером */
function PopularityHint({ value }: { value: number }) {
  const info = getPopularityInfo(value);
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-base leading-none">{info.emoji}</span>
      <span className={cn("text-xs font-medium", info.color)}>
        {info.label}
      </span>
      <span className="text-[11px] text-muted-foreground truncate">
        — {info.description}
      </span>
    </div>
  );
}

/** Полный гайд-диалог */
function PopularityGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-500" />
            Гайд: как оценивать популярность фильма
          </DialogTitle>
          <DialogDescription>
            Рекомендации основаны на модели SilverScheduler — научном алгоритме
            оптимизации расписаний кинотеатров
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Что это */}
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 p-4 space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              Что такое популярность?
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Популярность — это{" "}
              <strong>оценка коммерческого потенциала</strong> фильма, а не
              субъективное «нравится / не нравится». Она определяет, какую долю
              зала фильм способен заполнить при прочих равных условиях. В
              научной статье SilverScheduler это параметр{" "}
              <em>
                θ<sub>j</sub>
              </em>{" "}
              — «opening strength» (начальная привлекательность).
            </p>
          </div>

          {/* Как влияет */}
          <div className="rounded-xl bg-muted/50 border border-border/50 p-4 space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-emerald-500" />
              Как влияет на расписание?
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Популярность — <strong>прямой множитель</strong> в формуле
              прогноза посещаемости. Фильм с оценкой 10 при прочих равных
              условиях привлечёт в 2 раза больше зрителей, чем фильм с оценкой
              5. Алгоритм автоматически ставит популярные фильмы в лучшие слоты
              (пятница–суббота, 19:00–21:00) для максимизации общей выручки.
            </p>
          </div>

          {/* Таблица */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Шкала оценки</h4>
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/50">
                    <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground">
                      Оценка
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground">
                      Описание
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground">
                      Примеры
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {POPULARITY_GUIDE.map((g) => (
                    <tr
                      key={g.range[0]}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-base">{g.emoji}</span>
                          <span className={cn("font-semibold", g.color)}>
                            {g.range[0]}–{g.range[1]}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{g.label}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {g.description}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {g.examples}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Формула */}
          <div className="rounded-xl bg-muted/50 border border-border/50 p-4 space-y-2">
            <h4 className="font-semibold text-sm">Формула прогноза</h4>
            <p className="text-xs text-muted-foreground font-mono leading-relaxed">
              attendance = capacity × fill_rate ×{" "}
              <strong className="text-foreground">popularity</strong> ×
              release_decay × day_factor × time_factor × holiday_bonus
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Например, зал на 300 мест, суббота 20:00, популярность = 8 (0.8) →
              прогноз ≈ <strong>191 зритель</strong>. С популярностью 4 (0.4)
              при тех же условиях → ≈ <strong>95 зрителей</strong>.
            </p>
          </div>

          {/* Советы */}
          <div className="rounded-xl border-2 border-dashed border-border/50 p-4">
            <h4 className="font-semibold text-sm mb-2">💡 Советы</h4>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>
                <strong>Премьерная неделя</strong> — ставьте на 1–2 балла выше,
                чем обычно
              </li>
              <li>
                <strong>Каждая неделя проката</strong> — алгоритм автоматически
                применяет затухание (-15%/нед.)
              </li>
              <li>
                <strong>Фильмы для детей</strong> — алгоритм сам ограничивает их
                вечерние показы
              </li>
              <li>
                <strong>Ориентируйтесь на данные</strong> — кассовые сборы
                первой недели, рейтинги IMDb/КП, трейлерные просмотры
              </li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Понятно
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MovieDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movie?: Movie | null;
}

const INITIAL_FORM: MovieFormData = {
  title: "",
  originalTitle: "",
  genre: "drama",
  duration: 120,
  ageRating: "12+",
  releaseDate: new Date().toISOString().split("T")[0],
  posterUrl: "",
  description: "",
  director: "",
  popularity: 5,
  minShowsPerDay: 1,
  maxShowsPerDay: 4,
  isActive: true,
};

export function MovieDialog({ open, onOpenChange, movie }: MovieDialogProps) {
  const isEditing = !!movie;
  const [guideOpen, setGuideOpen] = useState(false);

  // Kinopoisk search state
  const [kpQuery, setKpQuery] = useState("");
  const [kpResults, setKpResults] = useState<KpSearchResult[]>([]);
  const [kpLoading, setKpLoading] = useState(false);
  const [kpFilling, setKpFilling] = useState(false);
  const [kpError, setKpError] = useState<string | null>(null);

  const [form, setForm] = useState<MovieFormData>(() => {
    if (movie) {
      return {
        title: movie.title,
        originalTitle: movie.originalTitle ?? "",
        genre: movie.genre,
        duration: movie.duration,
        ageRating: movie.ageRating,
        releaseDate: movie.releaseDate,
        posterUrl: movie.posterUrl ?? "",
        description: movie.description ?? "",
        director: movie.director ?? "",
        popularity: movie.popularity,
        minShowsPerDay: movie.minShowsPerDay,
        maxShowsPerDay: movie.maxShowsPerDay,
        isActive: movie.isActive,
      };
    }
    return { ...INITIAL_FORM };
  });

  const updateField = <K extends keyof MovieFormData>(
    key: K,
    value: MovieFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    if (isEditing && movie) {
      movieStore.updateMovie(movie.id, form);
    } else {
      movieStore.addMovie(form);
    }
    onOpenChange(false);
  };

  // Kinopoisk search handler
  async function handleKpSearch() {
    const q = kpQuery.trim() || form.title.trim();
    if (!q) return;
    setKpLoading(true);
    setKpError(null);
    setKpResults([]);
    try {
      const results = await kpSearch(q);
      setKpResults(results);
      if (results.length === 0) setKpError("Ничего не найдено");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("503") || msg.includes("502")) {
        setKpError(
          "КиноПоиск API недоступен с этой сети. Настройте HTTPS_PROXY в .env бэкенда.",
        );
      } else if (msg.includes("501")) {
        setKpError("KP_API_KEY не задан в .env бэкенда.");
      } else {
        setKpError("Ошибка поиска: " + msg);
      }
    } finally {
      setKpLoading(false);
    }
  }

  // Fill form from Kinopoisk details
  async function handleKpSelect(kpId: number) {
    setKpFilling(true);
    try {
      const d = await kpDetails(kpId);
      setForm((prev) => ({
        ...prev,
        title: d.title || prev.title,
        originalTitle: d.originalTitle || prev.originalTitle,
        genre: (d.genre as Genre) || prev.genre,
        duration: d.duration || prev.duration,
        ageRating: (d.ageRating as AgeRating) || prev.ageRating,
        releaseDate: d.releaseDate || prev.releaseDate,
        posterUrl: d.posterUrl || prev.posterUrl,
        description: d.description || prev.description,
        director: d.director || prev.director,
        popularity: d.popularity || prev.popularity,
      }));
      setKpResults([]);
      setKpQuery("");
    } catch {
      setKpError("Не удалось загрузить детали фильма");
    } finally {
      setKpFilling(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Редактирование фильма" : "Добавить фильм"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Измените информацию о фильме"
                : "Заполните информацию о новом фильме для расписания кинотеатра"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Поиск в КиноПоиске */}
            {!isEditing && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Globe className="h-4 w-4 text-blue-500" />
                  Быстрое заполнение из КиноПоиска
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Название фильма на русском или английском..."
                    value={kpQuery}
                    onChange={(e) => setKpQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleKpSearch();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={kpLoading}
                    onClick={handleKpSearch}
                    className="gap-1.5 shrink-0"
                  >
                    {kpLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    Найти
                  </Button>
                </div>

                {/* Ошибка */}
                {kpError && <p className="text-xs text-red-500">{kpError}</p>}

                {/* Результаты */}
                {kpResults.length > 0 && (
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-border/50 bg-background divide-y divide-border/30">
                    {kpResults.map((r) => (
                      <button
                        key={r.kpId}
                        type="button"
                        disabled={kpFilling}
                        onClick={() => handleKpSelect(r.kpId)}
                        className="w-full flex items-start gap-3 p-2.5 text-left hover:bg-muted/50 transition-colors disabled:opacity-50"
                      >
                        {r.posterUrl ? (
                          <img
                            src={r.posterUrl}
                            alt=""
                            className="w-10 h-14 rounded object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-14 rounded bg-muted flex items-center justify-center shrink-0">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {r.title}
                          </p>
                          {r.originalTitle && r.originalTitle !== r.title && (
                            <p className="text-xs text-muted-foreground truncate">
                              {r.originalTitle}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            {r.year && (
                              <span className="text-[11px] text-muted-foreground">
                                {r.year}
                              </span>
                            )}
                            {r.rating > 0 && (
                              <span className="text-[11px] text-amber-500 flex items-center gap-0.5">
                                <Star className="h-2.5 w-2.5 fill-amber-400" />
                                {r.rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        {kpFilling && (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0 mt-1" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Основная информация */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Название *</Label>
                <Input
                  id="title"
                  placeholder="Название фильма"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="originalTitle">Оригинальное название</Label>
                <Input
                  id="originalTitle"
                  placeholder="Original Title"
                  value={form.originalTitle}
                  onChange={(e) => updateField("originalTitle", e.target.value)}
                />
              </div>
            </div>

            {/* Жанр и рейтинг */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Жанр</Label>
                <Select
                  value={form.genre}
                  onValueChange={(v) => updateField("genre", v as Genre)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GENRE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Возрастной рейтинг</Label>
                <Select
                  value={form.ageRating}
                  onValueChange={(v) =>
                    updateField("ageRating", v as AgeRating)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_RATING_OPTIONS.map((rating) => (
                      <SelectItem key={rating} value={rating}>
                        {rating}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Длительность (мин)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  max={600}
                  value={form.duration}
                  onChange={(e) =>
                    updateField("duration", Number(e.target.value))
                  }
                />
              </div>
            </div>

            {/* Режиссёр и дата */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="director">Режиссёр</Label>
                <Input
                  id="director"
                  placeholder="Имя режиссёра"
                  value={form.director}
                  onChange={(e) => updateField("director", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="releaseDate">Дата выхода</Label>
                <Input
                  id="releaseDate"
                  type="date"
                  value={form.releaseDate}
                  onChange={(e) => updateField("releaseDate", e.target.value)}
                />
              </div>
            </div>

            {/* Постер */}
            <div className="space-y-2">
              <Label htmlFor="posterUrl">URL постера</Label>
              <Input
                id="posterUrl"
                placeholder="https://example.com/poster.jpg"
                value={form.posterUrl}
                onChange={(e) => updateField("posterUrl", e.target.value)}
              />
            </div>

            {/* Описание */}
            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                placeholder="Краткое описание фильма..."
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={3}
              />
            </div>

            {/* Параметры расписания */}
            <div className="rounded-lg border p-4 space-y-4">
              <h4 className="font-medium text-sm">Параметры расписания</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2 sm:col-span-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="popularity">
                      Популярность ({form.popularity}/10)
                    </Label>
                    <button
                      type="button"
                      onClick={() => setGuideOpen(true)}
                      className="h-5 w-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                      title="Как оценивать популярность?"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Input
                    id="popularity"
                    type="range"
                    min={1}
                    max={10}
                    value={form.popularity}
                    onChange={(e) =>
                      updateField("popularity", Number(e.target.value))
                    }
                    className="h-9"
                  />
                  <PopularityHint value={form.popularity} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minShows">Мин. сеансов/день</Label>
                  <Input
                    id="minShows"
                    type="number"
                    min={0}
                    max={10}
                    value={form.minShowsPerDay}
                    onChange={(e) =>
                      updateField("minShowsPerDay", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxShows">Макс. сеансов/день</Label>
                  <Input
                    id="maxShows"
                    type="number"
                    min={1}
                    max={20}
                    value={form.maxShowsPerDay}
                    onChange={(e) =>
                      updateField("maxShowsPerDay", Number(e.target.value))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Активность */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => updateField("isActive", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Фильм активен (участвует в генерации расписания)
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Отмена
              </Button>
              <Button type="submit">
                {isEditing ? "Сохранить" : "Добавить"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <PopularityGuideDialog open={guideOpen} onOpenChange={setGuideOpen} />
    </>
  );
}
