import { Injectable, signal, computed } from "@angular/core";

@Injectable({ providedIn: "root" })
export class LoadingService {
  private _loadingCount = signal(0);
  isLoading = computed(() => this._loadingCount() > 0);
  loadingMessage = signal<string | null>(null);

  show(message?: string): void {
    this._loadingCount.update((c) => c + 1);
    if (message) {
      this.loadingMessage.set(message);
    }
  }

  hide(): void {
    this._loadingCount.update((c) => {
      const newCount = c - 1;
      return newCount < 0 ? 0 : newCount;
    });
  }

  reset(): void {
    this._loadingCount.set(0);
    this.loadingMessage.set(null);
  }

  setMessage(msg: string | null): void {
    this.loadingMessage.set(msg);
  }
}
