import { Injectable, inject } from "@angular/core";
import { ConnectionStateService } from "@services/services.connection-state.service";
import { DataProviderService } from "@services/data-provider.service";
import { LoadingService } from "@shared/services/loading.service";
import { withConnectionAndLoading } from "@shared/utils/api-wrapper.util";
import { ApiProvider } from "@providers/providers.api.provider";
import { QueryParams, QueryResult, RowData } from "@entities/entities.connection.config";
@Injectable({ providedIn: "root" })
export class QueryService {
  private connectionState = inject(ConnectionStateService);
  private dataProvider = inject(DataProviderService);
  private loadingService = inject(LoadingService);
  private api = inject(ApiProvider);

  async queryData(collection: string, params: QueryParams): Promise<QueryResult<RowData>> {
    const connId = this.connectionState.activeConnectionId();
    const startTime = performance.now();
    const result = await withConnectionAndLoading(
      connId,
      this.loadingService,
      "Executing query...",
      (connId) => this.api.queryData(connId, collection, params)
    );
    return result;
  }

  async saveRow(collection: string, data: Record<string, unknown>): Promise<unknown> {
    const connId = this.connectionState.activeConnectionId();
    const startTime = performance.now();
    const result = await withConnectionAndLoading(
      connId,
      this.loadingService,
      "Saving row...",
      (connId) =>
        this.api.saveRow(connId, collection, data).then((result) => {
          this.dataProvider.invalidateCache(collection);
          return result;
        })
    );
    return result;
  }

  async deleteRow(collection: string, id: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    const startTime = performance.now();
    await withConnectionAndLoading(connId, this.loadingService, "Deleting row...", (connId) =>
      this.api.deleteRow(connId, collection, id).then(() => {
        this.dataProvider.invalidateCache(collection);
      })
    );
  }
}
