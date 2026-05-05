export abstract class HistoryManager<T> {
  protected abstract readonly STORAGE_KEY: string;
  protected abstract readonly MAX_ITEMS: number;

  loadHistory(): T[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return [];
  }

  saveHistory(history: T[]): void {
    try {
      const trimmed = history.slice(0, this.MAX_ITEMS);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
    } catch {}
  }

  addItem(history: T[], item: T, isEqual?: (a: T, b: T) => boolean): T[] {
    const filtered = isEqual
      ? history.filter((h) => !isEqual(h, item))
      : history.filter((h) => h !== item);
    return [item, ...filtered].slice(0, this.MAX_ITEMS);
  }
}
