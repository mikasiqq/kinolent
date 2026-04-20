import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { authStore } from "@/stores/authStore";
import { scheduleStore } from "@/stores/scheduleStore";
import {
  MessageCircle,
  MessageSquare,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { observer } from "mobx-react";
import { useEffect, useRef, useState } from "react";

// ── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} д назад`;
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function userInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "from-violet-500 to-indigo-500",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-fuchsia-500 to-purple-500",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Compact Comment Badge ───────────────────────────────────────────────────

export const CommentBadge = observer(function CommentBadge({
  scheduleId,
  onOpenDialog,
}: {
  scheduleId: string;
  onOpenDialog: () => void;
}) {
  useEffect(() => {
    scheduleStore.loadComments(scheduleId);
  }, [scheduleId]);

  const data = scheduleStore.commentsData;
  if (scheduleStore.commentsLoading || !data) return null;

  const count = data.totalComments;

  return (
    <button
      onClick={onOpenDialog}
      className={cn(
        "group relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 cursor-pointer",
        count > 0
          ? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
          : "bg-muted/60 text-muted-foreground hover:bg-muted",
      )}
    >
      <MessageCircle
        className={cn(
          "h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110",
          count > 0 && "fill-blue-200 dark:fill-blue-800",
        )}
      />
      {count > 0 ? count : "0"}
    </button>
  );
});

// ── Full Comment Dialog ─────────────────────────────────────────────────────

export const CommentDialog = observer(function CommentDialog({
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
  const data = scheduleStore.commentsData;
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) scheduleStore.loadComments(scheduleId);
  }, [open, scheduleId]);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSaving(true);
    await scheduleStore.addComment(scheduleId, text.trim());
    setText("");
    setSaving(false);
    // scroll to top (newest first)
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const canDelete = authStore.can("manage");
  const comments = data?.comments ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5">
          {/* Subtle background glow */}
          <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-blue-500/8 blur-3xl dark:bg-blue-400/5" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-indigo-500/6 blur-2xl dark:bg-indigo-400/4" />

          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-3 text-lg font-semibold">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <span className="block">Обсуждение</span>
                <DialogDescription className="text-xs font-normal text-muted-foreground mt-0.5">
                  {scheduleName}
                </DialogDescription>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Stats pills */}
          {comments.length > 0 && (
            <div className="relative flex items-center gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                <MessageCircle className="h-3 w-3" />
                {comments.length}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-900/20 px-2.5 py-1 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                <Users className="h-3 w-3" />
                {new Set(comments.map((c) => c.userName)).size}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="mt-4 -mx-6 border-b border-border/40" />
        </div>

        {/* Hint */}
        <div className="mx-6 mt-4 mb-2 rounded-lg bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 px-3 py-2 text-[11px] text-indigo-600/80 dark:text-indigo-400/80">
          Оставляйте комментарии для согласования расписания: что улучшить,
          подтвердить готовность или предложить изменения.
        </div>

        {/* Comment list */}
        <div
          ref={listRef}
          className={cn(
            "px-6 overflow-y-auto",
            comments.length > 0 ? "py-3 max-h-72" : "py-8",
          )}
        >
          {comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="group flex gap-3">
                  {/* Avatar */}
                  <div
                    className={cn(
                      "shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white bg-linear-to-br",
                      avatarColor(c.userName),
                    )}
                  >
                    {userInitials(c.userName)}
                  </div>
                  {/* Bubble */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold truncate">
                        {c.userName}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50 shrink-0">
                        {timeAgo(c.createdAt)}
                      </span>
                      {canDelete && (
                        <button
                          onClick={() =>
                            scheduleStore.removeComment(scheduleId, c.id)
                          }
                          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/30 hover:text-red-500 shrink-0"
                          title="Удалить"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                      {c.comment}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/40 mb-3">
                <MessageCircle className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Пока нет комментариев
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                Начните обсуждение расписания
              </p>
            </div>
          )}
        </div>

        {/* Input area — pinned at bottom */}
        <div className="border-t border-border/40 bg-muted/20 px-6 py-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Комментарий… ⌘↵"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="resize-none min-h-9 max-h-24 text-sm bg-background"
            />
            <Button
              onClick={handleSubmit}
              disabled={!text.trim() || saving}
              size="icon"
              className={cn(
                "shrink-0 h-9 w-9 rounded-xl transition-all duration-200",
                text.trim()
                  ? "bg-linear-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md shadow-blue-500/20"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
