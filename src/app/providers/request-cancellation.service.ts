import { Injectable, inject } from "@angular/core";
import { invoke, InvokeOptions } from "@tauri-apps/api/core";
import { TauriBridgeService } from "./tauri-bridge.service";
import { getLoggingService } from "@tauri-apps/logger";

@Injectable({ providedIn: "root" })
export class RequestCancellationService {
  private abortController: AbortController | null = null;
  private abortTimeoutId: number | undefined;
  private tauriBridge = inject(TauriBridgeService);
  private logger = getLoggingService();

  private getTimeoutMs(): number {
    return this.tauriBridge.getConnectionTimeoutMs();
  }

  createAbortSignal(): AbortSignal {
    this.abortController?.abort();
    this.abortController = new AbortController();
    clearTimeout(this.abortTimeoutId);
    this.abortTimeoutId = window.setTimeout(
      () => this.abortController?.abort(),
      this.getTimeoutMs()
    );
    return this.abortController.signal;
  }

  getFastAbortSignal(): AbortSignal {
    this.abortController?.abort();
    this.abortController = new AbortController();
    return this.abortController.signal;
  }

  getAbortSignal(): AbortSignal {
    return this.createAbortSignal();
  }

  cancelPendingRequests(): void {
    this.logger.info("[CANCELLATION]", "Cancelling pending requests");
    clearTimeout(this.abortTimeoutId);
    this.abortTimeoutId = undefined;
    this.abortController?.abort();
  }

  getActiveAbortController(): AbortController | null {
    return this.abortController;
  }
}
