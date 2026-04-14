/**
 * MoviePoster — постер фильма с корректным fallback при ошибке загрузки.
 * Если URL некорректный или изображение не загружается — всегда показывает
 * градиентный фон с эмодзи жанра, как в разделе «Фильмы».
 */
import { cn } from "@/lib/utils";
import { GENRE_EMOJI, GENRE_GRADIENT, type Genre } from "@/types/movie";
import { Film } from "lucide-react";
import { useState } from "react";

interface MoviePosterProps {
  posterUrl?: string | null;
  title: string;
  genre?: Genre | string;
  /** CSS-класс для обёртки (определяет размер/форму) */
  className?: string;
  /** Размер эмодзи в fallback (tailwind text-*). По умолчанию text-4xl */
  emojiSize?: string;
  /** Показывать ли заголовок под эмодзи в fallback */
  showTitle?: boolean;
  /** lazy | eager */
  loading?: "lazy" | "eager";
}

export function MoviePoster({
  posterUrl,
  title,
  genre,
  className,
  emojiSize = "text-4xl",
  showTitle = false,
  loading = "lazy",
}: MoviePosterProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const g = (genre ?? "drama") as Genre;
  const gradient = GENRE_GRADIENT[g] ?? "from-slate-600 to-gray-800";
  const emoji = GENRE_EMOJI[g] ?? "🎬";

  const showImage = !!posterUrl && !error;

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {/* Скелетон пока грузится */}
      {showImage && !loaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}

      {showImage ? (
        <img
          src={posterUrl}
          alt=""
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500",
            loaded ? "opacity-100" : "opacity-0",
          )}
          loading={loading}
          onError={() => setError(true)}
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full flex-col items-center justify-center gap-2",
            "bg-linear-to-br",
            gradient,
          )}
        >
          <span className={cn("drop-shadow-md", emojiSize)}>{emoji}</span>
          {showTitle && (
            <span className="text-white/80 font-medium text-xs text-center px-2 line-clamp-2">
              {title}
            </span>
          )}
          {!genre && <Film className="h-4 w-4 text-white/50" />}
        </div>
      )}
    </div>
  );
}
