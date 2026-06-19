import { Injectable, signal, computed, inject } from "@angular/core";
@Injectable({ providedIn: "root" })
export class LoadingService {
  private _loadingCount = signal(0);
  isLoading = computed(() => this._loadingCount() > 0);
  loadingMessage = signal<string | null>(null);

  show(message?: string): void {
    this._loadingCount.update((c) => Math.max(0, c + 1));
    if (message) {
      this.loadingMessage.set(message);
    }
  }

  hide(): void {
    this._loadingCount.update((c) => Math.max(0, c - 1));
  }

  reset(): void {
    this._loadingCount.set(0);
    this.loadingMessage.set(null);
  }

  setMessage(msg: string | null): void {
    this.loadingMessage.set(msg);
  }
}
