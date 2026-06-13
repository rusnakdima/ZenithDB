import { Injectable, signal, computed, inject } from "@angular/core";
import { PersistentStorageService } from "@shared/services/persistent-storage.service";
import { LoggingService } from "@shared/services/logging.service";

export interface HistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  success: boolean;
}

@Injectable()
export class QueryEditorStore {
  private storage = inject(PersistentStorageService);
  private logger = inject(LoggingService);

  readonly showHistory = signal(false);
  readonly history = signal<HistoryItem[]>([]);

  readonly historyCount = computed(() => this.history().length);

  loadHistory(): void {
    const stored = this.storage.get<HistoryItem[]>("zenith_query_history");
    if (stored) {
      this.history.set(
        stored.map((h) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        }))
      );
    } else {
      this.history.set([]);
    }
  }

  saveHistory(): void {
    const limited = this.history().slice(0, 20);
    this.storage.set(
      "zenith_query_history",
      limited.map((h) => ({ ...h, timestamp: h.timestamp.toISOString() }))
    );
  }

  addToHistory(query: string, success: boolean): void {
    this.logger.debug("[QUERY]", "Adding to history", { queryLength: query.length, success });
    const item: HistoryItem = {
      id: crypto.randomUUID(),
      query,
      timestamp: new Date(),
      success,
    };
    const newHistory = [item, ...this.history().filter((h) => h.query !== query)].slice(0, 20);
    this.history.set(newHistory);
    this.saveHistory();
  }

  deleteHistoryItem(id: string): void {
    this.history.set(this.history().filter((h) => h.id !== id));
    this.saveHistory();
  }

  clearAllHistory(): void {
    this.logger.debug("[QUERY]", "Clearing all query history");
    this.history.set([]);
    this.storage.remove("zenith_query_history");
  }

  toggleHistory(): void {
    this.showHistory.update((v) => !v);
  }
}
