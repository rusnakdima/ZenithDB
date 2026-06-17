import { Injectable, signal, computed, inject } from "@angular/core";
import { logger } from "../../services/logger.service";

@Injectable({ providedIn: "root" })
export class LoadingService {
  
  private _loadingCount = signal(0);
  isLoading = computed(() => this._loadingCount() > 0);
  loadingMessage = signal<string | null>(null);

  show(message?: string): void {
    logger.debug("[LOADING]", "show called", { message });
    this._loadingCount.update((c) => Math.max(0, c + 1));
    if (message) {
      this.loadingMessage.set(message);
    }
  }

  hide(): void {
    logger.debug("[LOADING]", "hide called");
    this._loadingCount.update((c) => Math.max(0, c - 1));
  }

  reset(): void {
    logger.debug("[LOADING]", "reset called");
    this._loadingCount.set(0);
    this.loadingMessage.set(null);
  }

  setMessage(msg: string | null): void {
    logger.debug("[LOADING]", "setMessage called", { msg });
    this.loadingMessage.set(msg);
  }
}
