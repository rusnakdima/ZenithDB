import { Injectable } from "@angular/core";

export type SplitMode = "none" | "horizontal" | "vertical";
export type FilterHistory = string[];

const KEYS = {
  SETTINGS: "zenithdb-settings",
  FILTER_HISTORY: "zenithdb_filter_history",
  EXPLORER_SPLIT_MODE: "explorer_split_mode",
  COLUMN_ORDER: (collectionName: string) => `col_order_${collectionName}`,
} as const;

@Injectable({ providedIn: "root" })
export class PersistentStorageService {
  get<T>(key: string): T | null {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as T;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }

  getSettings<T>(): T | null {
    return this.get<T>(KEYS.SETTINGS);
  }

  setSettings<T>(settings: T): void {
    this.set(KEYS.SETTINGS, settings);
  }

  getFilterHistory(): FilterHistory {
    return this.get<FilterHistory>(KEYS.FILTER_HISTORY) ?? [];
  }

  setFilterHistory(history: FilterHistory): void {
    this.set(KEYS.FILTER_HISTORY, history);
  }

  getExplorerSplitMode(): SplitMode | null {
    const stored = localStorage.getItem(KEYS.EXPLORER_SPLIT_MODE);
    if (stored && ["none", "horizontal", "vertical"].includes(stored)) {
      return stored as SplitMode;
    }
    return null;
  }

  setExplorerSplitMode(mode: SplitMode): void {
    localStorage.setItem(KEYS.EXPLORER_SPLIT_MODE, mode);
  }

  getColumnOrder(collectionName: string): string[] {
    return this.get<string[]>(KEYS.COLUMN_ORDER(collectionName)) ?? [];
  }

  setColumnOrder(collectionName: string, order: string[]): void {
    this.set(KEYS.COLUMN_ORDER(collectionName), order);
  }
}
