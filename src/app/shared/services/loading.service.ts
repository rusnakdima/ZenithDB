import { Injectable, signal, computed, inject } from "@angular/core";
import { LoggerService } from "@shared/services/logger.service";

@Injectable({ providedIn: "root" })
export class LoadingService {
  private logger = inject(LoggerService);
  private _loadingCount = signal(0);
  isLoading = computed(() => this._loadingCount() > 0);
  loadingMessage = signal<string | null>(null);

  show(message?: string): void {
    this.logger.debug("[LOADING]", "show called", { message });
    this._loadingCount.update((c) => Math.max(0, c + 1));
    if (message) {
      this.loadingMessage.set(message);
    }
  }

  hide(): void {
    this.logger.debug("[LOADING]", "hide called");
    this._loadingCount.update((c) => Math.max(0, c - 1));
  }

  reset(): void {
    this.logger.debug("[LOADING]", "reset called");
    this._loadingCount.set(0);
    this.loadingMessage.set(null);
  }

  setMessage(msg: string | null): void {
    this.logger.debug("[LOADING]", "setMessage called", { msg });
    this.loadingMessage.set(msg);
  }
}
