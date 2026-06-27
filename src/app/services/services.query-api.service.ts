import { Injectable, inject } from "@angular/core";
import { CacheService } from "@shared/services/cache.service";
import { TauriBridgeService } from "@providers/providers.tauri-bridge.service";
import { RequestCancellationService } from "@providers/providers.request-cancellation.service";
import { QueryParams, QueryResult, RawResult, RowData } from "@entities/entities.connection.config";

@Injectable({ providedIn: "root" })
export class QueryApiService extends CacheService {
  private tauriBridge = inject(TauriBridgeService);
  private cancellation = inject(RequestCancellationService);

  async queryData(
    connId: string,
    collection: string,
    params: QueryParams
  ): Promise<QueryResult<RowData>> {
    return this.tauriBridge.invoke<QueryResult<RowData>>(
      "query_execute",
      { connectionId: connId, collection, params },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }

  async saveRow(
    connId: string,
    collection: string,
    data: Record<string, unknown>
  ): Promise<RowData | null> {
    return this.tauriBridge.invoke<RowData>(
      "query_save",
      { connectionId: connId, collection, data },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }

  async deleteRow(connId: string, collection: string, id: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "query_delete",
      { connectionId: connId, collection, id },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }

  async executeRaw(connId: string, sql: string): Promise<RawResult> {
    return this.tauriBridge.invoke<RawResult>(
      "query_raw",
      { connectionId: connId, sql },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }

  async getServerVersion(connId: string): Promise<string> {
    return this.tauriBridge.invoke<string>(
      "query_server_version",
      { connectionId: connId },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }

  async rebuildIndex(connId: string, collection: string, indexName: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "rebuild_index",
      { connId: connId, collection, indexName },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }

  async createIndex(connId: string, collection: string, indexDef: unknown): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "create_index",
      { connId: connId, collection, index_definition: indexDef },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }

  async dropIndex(connId: string, collection: string, indexName: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "drop_index",
      { connId: connId, collection, indexName },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }

  async insertDocument(connId: string, collection: string, data: RowData): Promise<RowData | null> {
    return this.tauriBridge.invoke<RowData>(
      "insert_document",
      { connId, collection, data },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }

  async updateDocument(
    connId: string,
    collection: string,
    id: string,
    data: RowData
  ): Promise<RowData | null> {
    return this.tauriBridge.invoke<RowData>(
      "update_document",
      { connId, collection, id, data },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }

  async deleteDocument(connId: string, collection: string, id: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "delete_document",
      { connId, collection, id },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }

  async softDeleteDocument(connId: string, collection: string, id: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "soft_delete_document",
      { connId, collection, id },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }

  async queryAggregate(connId: string, collection: string, pipeline: object[]): Promise<RowData[]> {
    return this.tauriBridge.invoke<RowData[]>(
      "query_aggregate",
      { connectionId: connId, collection, pipeline },
      { signal: this.cancellation.createAbortSignal(), suppressError: true }
    );
  }
}
