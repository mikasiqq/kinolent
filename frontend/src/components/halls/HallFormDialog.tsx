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
import { hallStore } from "@/stores/hallStore";
import type { HallConfig, HallType } from "@/types/schedule";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const HALL_TYPES: { value: HallType; label: string }[] = [
  { value: "2D", label: "2D" },
  { value: "3D", label: "3D" },
  { value: "IMAX", label: "IMAX" },
  { value: "DOLBY_ATMOS", label: "Dolby Atmos" },
  { value: "VIP", label: "VIP" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hall: HallConfig | null;
}

export function HallFormDialog({ open, onOpenChange, hall }: Props) {
  const isEdit = !!hall;

  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(100);
  const [hallType, setHallType] = useState<HallType>("2D");
  const [cleaningMinutes, setCleaningMinutes] = useState(15);
  const [floor, setFloor] = useState(1);
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("23:30");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hall) {
      setName(hall.name);
      setCapacity(hall.capacity);
      setHallType(hall.hallType);
      setCleaningMinutes(hall.cleaningMinutes);
      setOpenTime(hall.openTime);
      setCloseTime(hall.closeTime);
    } else {
      setName("");
      setCapacity(100);
      setHallType("2D");
      setCleaningMinutes(15);
      setFloor(1);
      setOpenTime("09:00");
      setCloseTime("23:30");
    }
  }, [hall, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        capacity,
        hallType,
        cleaningMinutes,
        openTime,
        closeTime,
      };

      if (isEdit) {
        await hallStore.updateHall(hall.id, data);
      } else {
        await hallStore.addHall(data);
      }
      onOpenChange(false);
    } catch (err) {
      console.error("Save hall failed:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-120">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Редактировать зал" : "Новый зал"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Измените параметры кинозала"
                : "Заполните параметры нового кинозала"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Название */}
            <div className="grid gap-2">
              <Label htmlFor="hall-name">Название</Label>
              <Input
                id="hall-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Зал 1"
                required
              />
            </div>

            {/* Тип зала + Вместимость */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Тип зала</Label>
                <Select
                  value={hallType}
                  onValueChange={(v) => setHallType(v as HallType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HALL_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hall-capacity">Вместимость</Label>
                <Input
                  id="hall-capacity"
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Этаж + Время уборки */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="hall-floor">Этаж</Label>
                <Input
                  id="hall-floor"
                  type="number"
                  min={-2}
                  max={50}
                  value={floor}
                  onChange={(e) => setFloor(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hall-cleaning">Время уборки (мин)</Label>
                <Input
                  id="hall-cleaning"
                  type="number"
                  min={0}
                  max={120}
                  value={cleaningMinutes}
                  onChange={(e) => setCleaningMinutes(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Время работы */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="hall-open">Открытие</Label>
                <Input
                  id="hall-open"
                  type="time"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hall-close">Закрытие</Label>
                <Input
                  id="hall-close"
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
