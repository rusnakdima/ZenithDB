import { Injectable, inject } from "@angular/core";
import { TauriBridgeService } from "./tauri-bridge.service";
import { RequestCancellationService } from "./request-cancellation.service";
import { DataStoreService } from "@app/services/core/data-store.service";
import { ConnectionsApiService } from "@shared/services/connections-api.service";
import { ToastService } from "@services/toast.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import {
  ConnectionSummary,
  ConnectionConfig,
  ConnectionConfigResult,
  TestConnectionConfig,
  ConnectionHealth,
  CollectionMeta,
  CollectionSchema,
  CollectionStats,
  QueryParams,
  QueryResult,
  RawResult,
  SystemMetrics,
  RowData,
} from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class ApiProvider {
  private tauriBridge = inject(TauriBridgeService);
  private cancellation = inject(RequestCancellationService);

  private dataStore = inject(DataStoreService);
  private connectionsApi = inject(ConnectionsApiService);
  private toastService: ToastService | null = null;
  private errorHandler = inject(ErrorHandlerService);

  private getFastAbortSignal() {
    return this.cancellation.getFastAbortSignal();
  }

  private createAbortSignal() {
    return this.cancellation.createAbortSignal();
  }

  private isNetworkProvider(config: TestConnectionConfig): boolean {
    const configType = config.config.type;
    return configType !== "Json" && configType !== "Sqlite";
  }

  cancelPendingRequests(): void {
    this.cancellation.cancelPendingRequests();
  }

  private getToastService(): ToastService {
    if (!this.toastService) {
      this.toastService = inject(ToastService);
    }
    return this.toastService;
  }

  async listConnections(): Promise<ConnectionSummary[]> {
    return this.tauriBridge
      .invoke<ConnectionSummary[]>("list_connections", {}, { suppressError: true })
      .then((connections) => {
        return connections;
      })
      .catch((err) => {
        console.error("[API] listConnections error:", err);
        throw err;
      });
  }

  async getConnection(id: string): Promise<ConnectionConfigResult> {
    return this.tauriBridge.invoke<ConnectionConfigResult>(
      "get_connection",
      { id },
      { signal: this.getFastAbortSignal(), suppressError: true }
    );
  }

  async testConnectionStatus(id: string): Promise<ConnectionSummary> {
    try {
      return await this.tauriBridge.invoke<ConnectionSummary>(
        "test_connection_status",
        { id },
        { signal: this.createAbortSignal(), suppressError: true }
      );
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        const msg = "Connection timed out";
        this.getToastService().error(msg);
        throw new Error(msg);
      }
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(msg);
    }
  }

  async saveConnection(config: TestConnectionConfig): Promise<string> {
    const id = await this.tauriBridge.invoke<string>(
      "save_connection",
      { config },
      { signal: this.createAbortSignal(), suppressError: true }
    );
    await this.connectionsApi.listConnectionsWithRefresh();
    return id;
  }

  async deleteConnection(id: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "delete_connection",
      { id },
      { signal: this.createAbortSignal(), suppressError: true }
    );
    this.dataStore.removeConnection(id);
    await this.connectionsApi.listConnectionsWithRefresh();
  }

  async testConnection(config: TestConnectionConfig): Promise<ConnectionHealth> {
    try {
      const isNetwork = this.isNetworkProvider(config);
      const signal = isNetwork ? this.createAbortSignal() : this.getFastAbortSignal();

      return await this.tauriBridge.invoke<ConnectionHealth>(
        "test_connection",
        { config },
        { signal, suppressError: true }
      );
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        const msg = "Connection timed out";
        this.getToastService().error(msg);
        throw new Error(msg);
      }
      const msg = e instanceof Error ? e.message : String(e);
      this.getToastService().error(`Connection failed: ${msg}`);
      throw e;
    }
  }

  async listCollections(connId: string, dbName?: string): Promise<CollectionMeta[]> {
    const result = await this.tauriBridge.invoke<{
      collections: CollectionMeta[];
      has_more: boolean;
      total_count: number;
    }>(
      "collection_list",
      { conn_id: connId, db_name: dbName },
      { signal: this.createAbortSignal(), suppressError: true }
    );
    this.dataStore.updateCollections(connId, result.collections);
    return result.collections;
  }

  async listCollectionsPaginated(
    connId: string,
    dbName?: string,
    offset?: number,
    limit?: number
  ): Promise<{ collections: CollectionMeta[]; hasMore: boolean; totalCount: number }> {
    const result = await this.tauriBridge.invoke<{
      collections: CollectionMeta[];
      has_more: boolean;
      total_count: number;
    }>(
      "collection_list",
      { conn_id: connId, db_name: dbName, offset, limit },
      { signal: this.createAbortSignal(), suppressError: true }
    );
    return {
      collections: result.collections,
      hasMore: result.has_more,
      totalCount: result.total_count,
    };
  }

  async createDatabase(connId: string, name: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "create_database",
      { conn_id: connId, name },
      { signal: this.createAbortSignal(), suppressError: true }
    );
  }

  async describeCollection(connId: string, collection: string): Promise<CollectionSchema> {
    return this.tauriBridge.invoke<CollectionSchema>(
      "describe_collection",
      { conn_id: connId, collection },
      { signal: this.createAbortSignal(), suppressError: true }
    );
  }

  async getCollectionStats(connId: string, collection: string): Promise<CollectionStats> {
    return this.tauriBridge.invoke<CollectionStats>(
      "get_collection_stats",
      { conn_id: connId, collection },
      { signal: this.createAbortSignal(), suppressError: true }
    );
  }

  async queryData(
    connId: string,
    collection: string,
    params: QueryParams
  ): Promise<QueryResult<RowData>> {
    const result = await this.tauriBridge.invoke<QueryResult<unknown>>(
      "query_data",
      { conn_id: connId, collection, query: params },
      { signal: this.createAbortSignal(), suppressError: true }
    );
    return result as QueryResult<RowData>;
  }

  async saveRow(connId: string, collection: string, data: RowData): Promise<RowData | null> {
    return this.tauriBridge.invoke<RowData>(
      "save_row",
      { conn_id: connId, collection, data },
      { signal: this.createAbortSignal(), suppressError: true }
    );
  }

  async deleteRow(connId: string, collection: string, id: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "delete_row",
      { conn_id: connId, collection, id },
      { signal: this.createAbortSignal(), suppressError: true }
    );
  }

  async createCollection(connId: string, name: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "create_collection",
      { conn_id: connId, name },
      { signal: this.createAbortSignal(), suppressError: true }
    );
    await this.listCollections(connId);
  }

  async dropCollection(connId: string, name: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "drop_collection",
      { conn_id: connId, name },
      { signal: this.createAbortSignal(), suppressError: true }
    );
    await this.listCollections(connId);
  }

  async executeRaw(connId: string, sql: string): Promise<RawResult> {
    return this.tauriBridge.invoke<RawResult>(
      "execute_raw",
      { conn_id: connId, sql },
      { signal: this.createAbortSignal(), suppressError: true }
    );
  }

  async getServerVersion(connId: string): Promise<string> {
    return this.tauriBridge.invoke<string>(
      "get_server_version",
      { conn_id: connId },
      { signal: this.createAbortSignal(), suppressError: true }
    );
  }

  async getSystemStatus(): Promise<SystemMetrics> {
    const metrics = await this.tauriBridge.invoke<SystemMetrics>(
      "get_system_status",
      {},
      { suppressError: true }
    );
    this.dataStore.updateSystemMetrics(metrics);
    return metrics;
  }

  async updateConnection(id: string, config: ConnectionConfig): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "update_connection",
      { id, config },
      { signal: this.createAbortSignal(), suppressError: true }
    );
    await this.connectionsApi.listConnectionsWithRefresh();
  }

  async renameCollection(connId: string, oldName: string, newName: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "rename_collection",
      { conn_id: connId, old_name: oldName, new_name: newName },
      { signal: this.createAbortSignal(), suppressError: true }
    );
  }

  async renameDatabase(connId: string, oldName: string, newName: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "rename_database",
      { conn_id: connId, old_name: oldName, new_name: newName },
      { signal: this.createAbortSignal(), suppressError: true }
    );
  }

  async deleteDatabase(connId: string, name: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "delete_database",
      { conn_id: connId, name },
      { signal: this.createAbortSignal(), suppressError: true }
    );
  }

  async createIndex(
    connId: string,
    collection: string,
    indexDef: {
      name: string;
      type: string;
      fields: { name: string; direction: string }[];
      options?: Record<string, unknown>;
    }
  ): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "create_index",
      { conn_id: connId, collection, indexDef },
      { signal: this.createAbortSignal(), suppressError: true }
    );
  }

  async dropIndex(connId: string, collection: string, indexName: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "drop_index",
      { conn_id: connId, collection, indexName },
      { signal: this.createAbortSignal(), suppressError: true }
    );
  }

  async rebuildIndex(connId: string, collection: string, indexName: string): Promise<void> {
    await this.tauriBridge.invoke<void>(
      "rebuild_index",
      { conn_id: connId, collection, indexName },
      { signal: this.createAbortSignal(), suppressError: true }
    );
  }
}
