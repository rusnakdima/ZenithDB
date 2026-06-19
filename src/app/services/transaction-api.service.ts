import { Injectable, inject } from "@angular/core";
import { CacheService } from "@shared/services/cache.service";
import { TauriBridgeService } from "@providers/tauri-bridge.service";
import { RequestCancellationService } from "@providers/request-cancellation.service";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";

@Injectable({ providedIn: "root" })
export class TransactionApiService extends CacheService {
  private tauriBridge = inject(TauriBridgeService);
  private cancellation = inject(RequestCancellationService);
  private readonly page = "TransactionApiService";

  async beginTransaction(
    connId: string,
    isolationLevel?: string
  ): Promise<{ transactionId: string }> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "beginTransaction", "begin_transaction", {
      connId,
      isolationLevel,
    });
    try {
      const result = await this.tauriBridge.invoke<{ transactionId: string }>(
        "begin_transaction",
        { connId, isolationLevel },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "beginTransaction",
        "begin_transaction",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(
        this.page,
        "beginTransaction",
        "begin_transaction",
        String(err),
        duration
      );
      throw err;
    }
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "commitTransaction", "commit_transaction", {
      transactionId,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "commit_transaction",
        { transactionId },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "commitTransaction",
        "commit_transaction",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(
        this.page,
        "commitTransaction",
        "commit_transaction",
        String(err),
        duration
      );
      throw err;
    }
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "rollbackTransaction", "rollback_transaction", {
      transactionId,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "rollback_transaction",
        { transactionId },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "rollbackTransaction",
        "rollback_transaction",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(
        this.page,
        "rollbackTransaction",
        "rollback_transaction",
        String(err),
        duration
      );
      throw err;
    }
  }
}
