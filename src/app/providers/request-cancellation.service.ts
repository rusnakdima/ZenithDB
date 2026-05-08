import { Injectable, inject } from "@angular/core";
import { invoke, InvokeOptions } from "@tauri-apps/api/core";
import { TauriBridgeService } from "./tauri-bridge.service";

@Injectable({ providedIn: "root" })
export class RequestCancellationService {
  private abortController: AbortController | null = null;
  private abortTimeoutId: number | undefined;
  private tauriBridge = inject(TauriBridgeService);

  private getTimeoutMs(): number {
    return this.tauriBridge.getConnectionTimeoutMs();
  }

  createAbortSignal(): AbortSignal {
    this.abortController?.abort();
    this.abortController = new AbortController();
    clearTimeout(this.abortTimeoutId);
    this.abortTimeoutId = setTimeout(
      () => this.abortController?.abort(),
      this.getTimeoutMs()
    ) as unknown as number;
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
    clearTimeout(this.abortTimeoutId);
    this.abortTimeoutId = undefined;
    this.abortController?.abort();
  }

  getActiveAbortController(): AbortController | null {
    return this.abortController;
  }
}
