import { useState, useCallback } from "react";
import { observer } from "mobx-react";
import {
  Clock,
  Star,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Play,
} from "lucide-react";
import type { Movie } from "@/types/movie";
import {
  GENRE_LABELS,
  GENRE_COLORS,
  GENRE_EMOJI,
  GENRE_GRADIENT,
} from "@/types/movie";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { movieStore } from "@/stores/movieStore";
import { cn } from "@/lib/utils";

interface MovieCardProps {
  movie: Movie;
  onEdit: (movie: Movie) => void;
}

export const MovieCard = observer(function MovieCard({
  movie,
  onEdit,
}: MovieCardProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleImgError = useCallback(() => setImgError(true), []);
  const handleImgLoad = useCallback(() => setImgLoaded(true), []);

  const hours = Math.floor(movie.duration / 60);
  const mins = movie.duration % 60;
  const durationStr = hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`;

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl overflow-hidden transition-all duration-500",
        "bg-card border border-border/50",
        "hover:shadow-2xl hover:shadow-black/10 hover:-translate-y-2 hover:border-border",
        !movie.isActive && "opacity-50 saturate-50",
      )}
    >
      {/* Постер */}
      <div className="relative aspect-2/3 w-full overflow-hidden bg-muted">
        {/* Скелетон загрузки */}
        {!imgLoaded && !imgError && movie.posterUrl && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}

        {movie.posterUrl && !imgError ? (
          <img
            src={movie.posterUrl}
            alt={movie.title}
            className={cn(
              "h-full w-full object-cover transition-all duration-700",
              "group-hover:scale-110",
              imgLoaded ? "opacity-100" : "opacity-0",
            )}
            loading="lazy"
            onError={handleImgError}
            onLoad={handleImgLoad}
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full flex-col items-center justify-center gap-3",
              "bg-linear-to-br",
              GENRE_GRADIENT[movie.genre],
            )}
          >
            <span className="text-6xl drop-shadow-lg">
              {GENRE_EMOJI[movie.genre]}
            </span>
            <span className="text-white/80 font-medium text-sm text-center px-4 line-clamp-2">
              {movie.title}
            </span>
          </div>
        )}

        {/* Градиент-оверлей снизу */}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-all duration-500 group-hover:opacity-100" />

        {/* Кнопка Play по центру на hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-500 cursor-pointer"
            onClick={() => onEdit(movie)}
          >
            <Play className="h-6 w-6 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* Бейдж статуса */}
        {!movie.isActive && (
          <div className="absolute top-3 left-3 z-10">
            <Badge className="bg-amber-500/90 text-white border-0 shadow-lg backdrop-blur-sm text-[10px] font-semibold">
              <EyeOff className="h-3 w-3 mr-1" />
              Скрыт
            </Badge>
          </div>
        )}

        {/* Возрастной рейтинг */}
        <div className="absolute top-3 right-3 z-10">
          <span
            className={cn(
              "inline-flex items-center justify-center h-7 min-w-7 px-1.5 rounded-md text-[11px] font-bold shadow-lg backdrop-blur-sm",
              movie.ageRating === "18+"
                ? "bg-red-600/90 text-white"
                : movie.ageRating === "16+"
                  ? "bg-orange-500/90 text-white"
                  : movie.ageRating === "12+"
                    ? "bg-yellow-500/90 text-white"
                    : "bg-green-500/90 text-white",
            )}
          >
            {movie.ageRating}
          </span>
        </div>

        {/* Длительность (внизу слева, видна на hover) */}
        <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
          <Badge className="bg-black/60 text-white border-0 backdrop-blur-sm text-[10px]">
            <Clock className="h-3 w-3 mr-1" />
            {durationStr}
          </Badge>
        </div>

        {/* Меню (внизу справа, видно на hover) */}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0 z-20">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-lg hover:bg-white/40"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onEdit(movie)}>
                <Pencil className="mr-2 h-4 w-4" />
                Редактировать
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => movieStore.toggleMovieActive(movie.id)}
              >
                {movie.isActive ? (
                  <>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Деактивировать
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Активировать
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => movieStore.deleteMovie(movie.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Информация под постером */}
      <div className="flex flex-col gap-2 p-4">
        {/* Жанр pill */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              GENRE_COLORS[movie.genre],
            )}
          >
            <span>{GENRE_EMOJI[movie.genre]}</span>
            {GENRE_LABELS[movie.genre]}
          </span>
        </div>

        {/* Название */}
        <h3 className="font-bold text-sm leading-snug line-clamp-2 tracking-tight">
          {movie.title}
        </h3>
        {movie.originalTitle && (
          <p className="text-[11px] text-muted-foreground line-clamp-1 -mt-1 italic">
            {movie.originalTitle}
          </p>
        )}

        {/* Режиссёр */}
        {movie.director && (
          <p className="text-xs text-muted-foreground/80 flex items-center gap-1">
            <span className="text-[10px]">🎬</span>
            <span className="line-clamp-1">{movie.director}</span>
          </p>
        )}

        {/* Рейтинг и сеансы */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
          {/* Звёзды */}
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
            <span className="text-xs font-semibold">{movie.popularity}</span>
            <span className="text-[10px] text-muted-foreground">/10</span>
          </div>
          {/* Сеансы */}
          <span className="text-[10px] text-muted-foreground">
            {movie.minShowsPerDay}–{movie.maxShowsPerDay} сеансов
          </span>
        </div>
      </div>
    </div>
  );
});
