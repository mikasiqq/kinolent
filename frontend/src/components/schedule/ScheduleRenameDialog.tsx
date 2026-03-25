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
import { scheduleStore } from "@/stores/scheduleStore";
import { Pencil } from "lucide-react";
import { useState } from "react";

interface ScheduleRenameDialogProps {
  scheduleId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ScheduleRenameDialog({
  scheduleId,
  currentName,
  open,
  onOpenChange,
}: ScheduleRenameDialogProps) {
  const [name, setName] = useState(currentName);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    scheduleStore.renameSchedule(scheduleId, name.trim());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-emerald-500" />
            Переименовать расписание
          </DialogTitle>
          <DialogDescription>Введите новое название</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="schedule-name">Название</Label>
            <Input
              id="schedule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Расписание на неделю"
              autoFocus
              required
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button
              type="submit"
              className="bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
            >
              Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
