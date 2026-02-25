/** Жанры фильмов */
export type Genre =
  | "action"
  | "comedy"
  | "drama"
  | "horror"
  | "sci-fi"
  | "thriller"
  | "romance"
  | "animation"
  | "documentary"
  | "fantasy";

/** Возрастной рейтинг */
export type AgeRating = "0+" | "6+" | "12+" | "16+" | "18+";

/** Модель фильма */
export interface Movie {
  id: string;
  title: string;
  originalTitle?: string;
  genre: Genre;
  duration: number; // минуты
  ageRating: AgeRating;
  releaseDate: string; // ISO date string
  posterUrl?: string;
  description?: string;
  director?: string;
  popularity: number; // 1-10
  minShowsPerDay: number;
  maxShowsPerDay: number;
  preferredTimeSlots?: string[]; // например ["morning", "evening"]
  isActive: boolean;
  createdAt: string;
}

/** Данные для создания/редактирования фильма */
export interface MovieFormData {
  title: string;
  originalTitle?: string;
  genre: Genre;
  duration: number;
  ageRating: AgeRating;
  releaseDate: string;
  posterUrl?: string;
  description?: string;
  director?: string;
  popularity: number;
  minShowsPerDay: number;
  maxShowsPerDay: number;
  preferredTimeSlots?: string[];
  isActive: boolean;
}

/** Человекочитаемые названия жанров */
export const GENRE_LABELS: Record<Genre, string> = {
  action: "Боевик",
  comedy: "Комедия",
  drama: "Драма",
  horror: "Ужасы",
  "sci-fi": "Фантастика",
  thriller: "Триллер",
  romance: "Мелодрама",
  animation: "Анимация",
  documentary: "Документальный",
  fantasy: "Фэнтези",
};

/** Цвета бейджей жанров */
export const GENRE_COLORS: Record<Genre, string> = {
  action: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  comedy:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  drama: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  horror:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "sci-fi": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  thriller: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  romance: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  animation:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  documentary:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  fantasy:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
};

/** Человекочитаемые рейтинги */
export const AGE_RATING_OPTIONS: AgeRating[] = [
  "0+",
  "6+",
  "12+",
  "16+",
  "18+",
];

/** Эмодзи жанров */
export const GENRE_EMOJI: Record<Genre, string> = {
  action: "💥",
  comedy: "😂",
  drama: "🎭",
  horror: "👻",
  "sci-fi": "🚀",
  thriller: "🔪",
  romance: "💕",
  animation: "🧸",
  documentary: "📹",
  fantasy: "🧙",
};

/** Цвета градиента для жанров (Tailwind) */
export const GENRE_GRADIENT: Record<Genre, string> = {
  action: "from-red-500 to-orange-500",
  comedy: "from-yellow-400 to-amber-500",
  drama: "from-blue-500 to-indigo-500",
  horror: "from-purple-600 to-violet-800",
  "sci-fi": "from-cyan-500 to-blue-600",
  thriller: "from-slate-600 to-gray-800",
  romance: "from-pink-400 to-rose-500",
  animation: "from-green-400 to-emerald-500",
  documentary: "from-orange-400 to-amber-600",
  fantasy: "from-indigo-500 to-purple-600",
};
