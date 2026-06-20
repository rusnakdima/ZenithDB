import { Injectable, inject } from "@angular/core";
import { CacheService } from "@shared/services/cache.service";
import { TauriBridgeService } from "@providers/providers.tauri-bridge.service";
import { RequestCancellationService } from "@providers/providers.request-cancellation.service";

@Injectable({ providedIn: "root" })
export class TransactionApiService extends CacheService {
  private tauriBridge = inject(TauriBridgeService);
  private cancellation = inject(RequestCancellationService);

  async beginTransaction(
    connId: string,
    isolationLevel?: string
  ): Promise<{ transactionId: string }> {
    return this.tauriBridge.invoke<{ transactionId: string }>(
      "begin_transaction",
      { connId, isolationLevel },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }

  async commitTransaction(transactionId: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "commit_transaction",
      { transactionId },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "rollback_transaction",
      { transactionId },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }
}
