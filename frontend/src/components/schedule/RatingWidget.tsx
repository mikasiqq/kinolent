import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { Star, MessageSquare, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { scheduleStore } from "@/stores/scheduleStore";
import { cn } from "@/lib/utils";

// ── Inline Star Rating ──────────────────────────────────────────────────────

interface StarRatingProps {
  value: number;
  onChange?: (val: number) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
}

function StarRating({ value, onChange, size = "md", readonly = false }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);

  const sizeClass = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";
  const gapClass = size === "sm" ? "gap-0.5" : "gap-1";

  return (
    <div className={cn("inline-flex items-center", gapClass)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value);
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            onClick={() => onChange?.(star)}
            className={cn(
              "transition-all duration-150",
              readonly ? "cursor-default" : "cursor-pointer hover:scale-110",
            )}
          >
            <Star
              className={cn(
                sizeClass,
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground/30",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

// ── Compact Rating Badge (for schedule card) ──────────────────────────────────

export const RatingBadge = observer(function RatingBadge({
  scheduleId,
  onOpenDialog,
}: {
  scheduleId: string;
  onOpenDialog: () => void;
}) {
  useEffect(() => {
    scheduleStore.loadRatings(scheduleId);
  }, [scheduleId]);

  const data = scheduleStore.ratingsData;
  if (scheduleStore.ratingsLoading || !data) {
    return null;
  }

  return (
    <button
      onClick={onOpenDialog}
      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/50 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 px-2.5 py-1 text-xs hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors cursor-pointer"
    >
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="font-semibold text-amber-700 dark:text-amber-400">
        {data.averageRating > 0 ? data.averageRating.toFixed(1) : "—"}
      </span>
      <span className="text-muted-foreground">({data.totalRatings})</span>
    </button>
  );
});

// ── Full Rating Dialog ────────────────────────────────────────────────────────

export const RatingDialog = observer(function RatingDialog({
  scheduleId,
  scheduleName,
  open,
  onOpenChange,
}: {
  scheduleId: string;
  scheduleName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const data = scheduleStore.ratingsData;
  const [myRating, setMyRating] = useState(data?.myRating ?? 0);
  const [myComment, setMyComment] = useState(data?.myComment ?? "");
  const [saving, setSaving] = useState(false);

  // Sync when data loads
  useEffect(() => {
    if (data) {
      setMyRating(data.myRating ?? 0);
      setMyComment(data.myComment ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.myRating, data?.myComment]);

  useEffect(() => {
    if (open) {
      scheduleStore.loadRatings(scheduleId);
    }
  }, [open, scheduleId]);

  async function handleSubmit() {
    if (myRating < 1) return;
    setSaving(true);
    await scheduleStore.rateSchedule(scheduleId, myRating, myComment || undefined);
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
            Оценка расписания
          </DialogTitle>
          <DialogDescription>
            {scheduleName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Общая оценка */}
          {data && data.totalRatings > 0 && (
            <div className="flex items-center gap-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 p-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {data.averageRating.toFixed(1)}
                </p>
                <p className="text-[10px] text-muted-foreground">из 5</p>
              </div>
              <div>
                <StarRating value={Math.round(data.averageRating)} readonly size="md" />
                <p className="text-xs text-muted-foreground mt-1">
                  {data.totalRatings}{" "}
                  {data.totalRatings === 1
                    ? "оценка"
                    : data.totalRatings < 5
                    ? "оценки"
                    : "оценок"}
                </p>
              </div>
            </div>
          )}

          {/* Моя оценка */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Ваша оценка</p>
            <StarRating value={myRating} onChange={setMyRating} size="lg" />
            <Textarea
              placeholder="Комментарий (необязательно)"
              value={myComment}
              onChange={(e) => setMyComment(e.target.value)}
              rows={2}
              className="resize-none"
            />
            <Button
              onClick={handleSubmit}
              disabled={myRating < 1 || saving}
              className="bg-linear-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 gap-1.5"
            >
              <Send className="h-4 w-4" />
              {saving
                ? "Сохранение..."
                : data?.myRating
                ? "Обновить оценку"
                : "Отправить оценку"}
            </Button>
          </div>

          {/* Все оценки */}
          {data && data.ratings.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Все оценки
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {data.ratings.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-border/50 bg-muted/20 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{r.userName}</span>
                      <StarRating value={r.rating} readonly size="sm" />
                    </div>
                    {r.comment && (
                      <p className="text-xs text-muted-foreground">{r.comment}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(r.createdAt).toLocaleString("ru-RU")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
