import {
  createHallApi,
  deleteHallApi,
  fetchHalls,
  updateHallApi,
} from "@/services/api";
import type { HallConfig, HallType } from "@/types/schedule";
import { makeAutoObservable, runInAction } from "mobx";

export interface HallFilters {
  search: string;
  hallType: HallType | "all";
}

class HallStore {
  halls: HallConfig[] = [];
  filters: HallFilters = { search: "", hallType: "all" };
  isLoading = false;
  selectedHallId: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  get filteredHalls(): HallConfig[] {
    return this.halls.filter((h) => {
      if (this.filters.search) {
        const q = this.filters.search.toLowerCase();
        if (!h.name.toLowerCase().includes(q)) return false;
      }
      if (
        this.filters.hallType !== "all" &&
        h.hallType !== this.filters.hallType
      )
        return false;
      return true;
    });
  }

  get totalCount() {
    return this.halls.length;
  }

  get totalCapacity() {
    return this.halls.reduce((s, h) => s + h.capacity, 0);
  }

  get selectedHall(): HallConfig | undefined {
    return this.halls.find((h) => h.id === this.selectedHallId);
  }

  setSearch(search: string) {
    this.filters.search = search;
  }

  setTypeFilter(type: HallType | "all") {
    this.filters.hallType = type;
  }

  selectHall(id: string | null) {
    this.selectedHallId = id;
  }

  async fetchHalls() {
    this.isLoading = true;
    try {
      const halls = await fetchHalls();
      runInAction(() => {
        this.halls = halls;
        this.isLoading = false;
      });
    } catch (e) {
      console.error("fetchHalls failed:", e);
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async addHall(data: Omit<HallConfig, "id" | "enabled">) {
    const created = await createHallApi(data);
    runInAction(() => {
      this.halls.unshift(created);
    });
  }

  async updateHall(id: string, data: Omit<HallConfig, "id" | "enabled">) {
    const updated = await updateHallApi(id, data);
    runInAction(() => {
      const idx = this.halls.findIndex((h) => h.id === id);
      if (idx !== -1) this.halls[idx] = updated;
    });
  }

  async deleteHall(id: string) {
    await deleteHallApi(id);
    runInAction(() => {
      this.halls = this.halls.filter((h) => h.id !== id);
    });
  }
}

export const hallStore = new HallStore();
