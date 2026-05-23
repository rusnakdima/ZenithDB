import { Injectable, inject } from "@angular/core";
import { TabService } from "@shared/services/tab.service";
import { ToastService } from "@services/toast.service";
import { DataStoreService } from "@services/core/data-store.service";
import { QueryResult, RawResult } from "@shared/models/connection.config";

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

  async executeWithTiming(query: string): Promise<QueryExecutionResult> {
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

      return { results: rawResults, executionTime, success: true };
    } catch (e: any) {
      const executionTime = performance.now() - startTime;
      const errorMessage = e.message || "Query failed";

      this.tabService.updateActiveTab({
        error: errorMessage,
        loading: false,
        executionTime,
      });

      this.toast.error(errorMessage);

      return { results: null, executionTime, success: false, error: errorMessage };
    }
  }
}
