import { Injectable, signal, computed } from "@angular/core";
import { PersistentStorageService } from "@shared/services/persistent-storage.service";
import { findById } from "@shared/utils/array.utils";

export interface QueryHistoryEntry {
  id: string;
  query: string;
  timestamp: number;
  duration: number;
  rowsReturned: number;
  success: boolean;
  collection?: string;
}

const QUERY_HISTORY_KEY = "query_history";
const MAX_HISTORY_SIZE = 100;

@Injectable({ providedIn: "root" })
export class QueryHistoryService {
  private readonly storageService = new PersistentStorageService();
  private readonly historySignal = signal<QueryHistoryEntry[]>([]);

  readonly history = this.historySignal.asReadonly();

  readonly totalQueries = computed(() => this.historySignal().length);

  readonly successfulQueries = computed(() => this.historySignal().filter((h) => h.success));

  readonly failedQueries = computed(() => this.historySignal().filter((h) => !h.success));

  readonly averageExecutionTime = computed(() => {
    const entries = this.historySignal();
    if (entries.length === 0) return 0;
    const total = entries.reduce((sum, h) => sum + h.duration, 0);
    return Math.round(total / entries.length);
  });

  readonly mostFrequentQueries = computed(() => {
    const queryCounts = new Map<string, { count: number; entry: QueryHistoryEntry }>();
    for (const entry of this.historySignal()) {
      const existing = queryCounts.get(entry.query);
      if (existing) {
        existing.count++;
      } else {
        queryCounts.set(entry.query, { count: 1, entry });
      }
    }
    return Array.from(queryCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((q) => q.entry);
  });

  readonly slowestQueries = computed(() => {
    return [...this.historySignal()].sort((a, b) => b.duration - a.duration).slice(0, 5);
  });

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const stored = this.storageService.get<QueryHistoryEntry[]>(QUERY_HISTORY_KEY);
    if (stored && Array.isArray(stored)) {
      this.historySignal.set(stored);
    }
  }

  private saveToStorage(): void {
    this.storageService.set(QUERY_HISTORY_KEY, this.historySignal());
  }

  addQuery(params: {
    query: string;
    duration: number;
    rowsReturned: number;
    success: boolean;
    collection?: string;
  }): void {
    const entry: QueryHistoryEntry = {
      id: crypto.randomUUID(),
      query: params.query,
      timestamp: Date.now(),
      duration: params.duration,
      rowsReturned: params.rowsReturned,
      success: params.success,
      collection: params.collection,
    };

    this.historySignal.update((history) => {
      const updated = [entry, ...history];
      if (updated.length > MAX_HISTORY_SIZE) {
        return updated.slice(0, MAX_HISTORY_SIZE);
      }
      return updated;
    });

    this.saveToStorage();
  }

  removeQuery(id: string): void {
    this.historySignal.update((history) => history.filter((h) => h.id !== id));
    this.saveToStorage();
  }

  clearHistory(): void {
    this.historySignal.set([]);
    this.storageService.remove(QUERY_HISTORY_KEY);
  }

  getQueryById(id: string): QueryHistoryEntry | undefined {
    return findById(this.historySignal(), id);
  }

  getFilteredHistory(filter: "all" | "successful" | "failed"): QueryHistoryEntry[] {
    switch (filter) {
      case "successful":
        return this.successfulQueries();
      case "failed":
        return this.failedQueries();
      default:
        return this.historySignal();
    }
  }
}
