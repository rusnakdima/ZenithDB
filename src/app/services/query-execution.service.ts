import { Injectable, inject } from "@angular/core";
import { TabService } from "@services/tab.service";
import { ToastService } from "@services/toast.service";
import { DataStoreService } from "@core/services/unified-storage.service";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { QueryResult, RawResult } from "@app/models/connection.config";

export interface QueryExecutionResult {
  results: RawResult | null;
  executionTime: number;
  success: boolean;
  error?: string;
}

@Injectable({ providedIn: "root" })
export class QueryExecutionService {
  private readonly tabService = inject(TabService);
  private readonly toast = inject(ToastService);
  private readonly store = inject(DataStoreService);
  private readonly dataflowLogger = inject(DataflowLoggerService);
  private readonly page = "QueryExecutionService";

  async executeWithTiming(query: string): Promise<QueryExecutionResult> {
    this.dataflowLogger.logApiCall(this.page, "executeWithTiming", "execute_raw", { query });
    this.tabService.updateActiveTab({ loading: true, error: "" });

    const startTime = performance.now();
    try {
      const rawResults = await this.store.executeRaw(query);
      const executionTime = performance.now() - startTime;

      this.tabService.updateActiveTab({
        results: rawResults,
        error: "",
        loading: false,
        executionTime,
        modified: false,
      });

      this.toast.success(`Query executed (${executionTime.toFixed(0)}ms)`);
      this.dataflowLogger.logDataReceive(
        this.page,
        "executeWithTiming",
        "execute_raw",
        { affectedRows: rawResults?.affected_rows },
        executionTime
      );

      return { results: rawResults, executionTime, success: true };
    } catch (e: unknown) {
      const executionTime = performance.now() - startTime;
      const errorMessage = e instanceof Error ? e.message : "Query failed";

      this.tabService.updateActiveTab({
        error: errorMessage,
        loading: false,
        executionTime,
      });

      this.toast.error(errorMessage);
      this.dataflowLogger.logError(
        this.page,
        "executeWithTiming",
        "execute_raw",
        errorMessage,
        executionTime
      );

      return { results: null, executionTime, success: false, error: errorMessage };
    }
  }
}
