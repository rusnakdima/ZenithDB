import { Injectable, inject } from "@angular/core";
import { TauriBridgeService } from "./tauri-bridge.service";
import { RequestCancellationService } from "./request-cancellation.service";
import { DataStoreService } from "@app/services/core/data-store.service";
import { ConnectionsApiService } from "@shared/services/connections-api.service";
import { ToastService } from "@services/toast.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import {
  invokeWithAbortHandling,
  invokeWithAbortHandlingOrDefault,
} from "@shared/utils/invoke-wrapper.util";
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
    const connections = await invokeWithAbortHandlingOrDefault(
      () => this.tauriBridge.invoke<ConnectionSummary[]>("list_connections", {}),
      "listConnections",
      this.errorHandler,
      []
    );
    this.dataStore.updateConnections(connections);
    return connections;
  }

  async getConnection(id: string): Promise<ConnectionConfigResult> {
    return invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<ConnectionConfigResult>("get_connection", {
          id,
          options: { signal: this.getFastAbortSignal() },
        }),
      "getConnection",
      this.errorHandler
    );
  }

  async testConnectionStatus(id: string): Promise<ConnectionSummary> {
    try {
      return await this.tauriBridge.invoke<ConnectionSummary>("test_connection_status", {
        id,
        options: { signal: this.createAbortSignal() },
      });
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
    const id = await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<string>("save_connection", {
          config,
          options: { signal: this.createAbortSignal() },
        }),
      "saveConnection",
      this.errorHandler
    );
    await this.connectionsApi.listConnectionsWithRefresh();
    return id;
  }

  async deleteConnection(id: string): Promise<void> {
    await invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<void>("delete_connection", {
          id,
          options: { signal: this.createAbortSignal() },
        }),
      "deleteConnection",
      this.errorHandler,
      undefined
    );
    this.dataStore.removeConnection(id);
    await this.connectionsApi.listConnectionsWithRefresh();
  }

  async testConnection(config: TestConnectionConfig): Promise<ConnectionHealth> {
    try {
      const isNetwork = this.isNetworkProvider(config);
      const signal = isNetwork ? this.createAbortSignal() : this.getFastAbortSignal();

      return await this.tauriBridge.invoke<ConnectionHealth>("test_connection", {
        config,
        options: { signal },
      });
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
    const result = await invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<{
          collections: CollectionMeta[];
          has_more: boolean;
          total_count: number;
        }>("collection_list", {
          connId: connId,
          dbName: dbName,
          options: { signal: this.createAbortSignal() },
        }),
      "listCollections",
      this.errorHandler,
      { collections: [], has_more: false, total_count: 0 }
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
    const result = await invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<{
          collections: CollectionMeta[];
          has_more: boolean;
          total_count: number;
        }>("collection_list", {
          connId: connId,
          dbName: dbName,
          offset,
          limit,
          options: { signal: this.createAbortSignal() },
        }),
      "listCollections",
      this.errorHandler,
      { collections: [], has_more: false, total_count: 0 }
    );
    return {
      collections: result.collections,
      hasMore: result.has_more,
      totalCount: result.total_count,
    };
  }

  async createDatabase(connId: string, name: string): Promise<void> {
    await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<void>("create_database", {
          connId: connId,
          name,
          options: { signal: this.createAbortSignal() },
        }),
      "createDatabase",
      this.errorHandler
    );
  }

  async describeCollection(connId: string, collection: string): Promise<CollectionSchema> {
    return invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<CollectionSchema>("describe_collection", {
          connId: connId,
          collection,
          options: { signal: this.createAbortSignal() },
        }),
      "describeCollection",
      this.errorHandler
    );
  }

  async getCollectionStats(connId: string, collection: string): Promise<CollectionStats> {
    return invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<CollectionStats>("get_collection_stats", {
          connId: connId,
          collection,
          options: { signal: this.createAbortSignal() },
        }),
      "getCollectionStats",
      this.errorHandler
    );
  }

  async queryData(
    connId: string,
    collection: string,
    params: QueryParams
  ): Promise<QueryResult<RowData>> {
    const result = await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<QueryResult<unknown>>("query_data", {
          connId: connId,
          collection,
          query: params,
          options: { signal: this.createAbortSignal() },
        }),
      "queryData",
      this.errorHandler
    );
    return result as QueryResult<RowData>;
  }

  async saveRow(connId: string, collection: string, data: RowData): Promise<RowData | null> {
    return invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<RowData>("save_row", {
          connId: connId,
          collection,
          data,
          options: { signal: this.createAbortSignal() },
        }),
      "saveRow",
      this.errorHandler,
      null
    );
  }

  async deleteRow(connId: string, collection: string, id: string): Promise<void> {
    await invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<void>("delete_row", {
          connId: connId,
          collection,
          id,
          options: { signal: this.createAbortSignal() },
        }),
      "deleteRow",
      this.errorHandler,
      undefined
    );
  }

  async createCollection(connId: string, name: string): Promise<void> {
    await invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<void>("create_collection", {
          connId: connId,
          name,
          options: { signal: this.createAbortSignal() },
        }),
      "createCollection",
      this.errorHandler,
      undefined
    );
    await this.listCollections(connId);
  }

  async dropCollection(connId: string, name: string): Promise<void> {
    await invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<void>("drop_collection", {
          connId: connId,
          name,
          options: { signal: this.createAbortSignal() },
        }),
      "dropCollection",
      this.errorHandler,
      undefined
    );
    await this.listCollections(connId);
  }

  async executeRaw(connId: string, sql: string): Promise<RawResult> {
    return invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<RawResult>("execute_raw", {
          connId: connId,
          sql,
          options: { signal: this.createAbortSignal() },
        }),
      "executeRaw",
      this.errorHandler,
      { columns: [], rows: [], affected_rows: 0 } as RawResult
    );
  }

  async getServerVersion(connId: string): Promise<string> {
    return invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<string>("get_server_version", {
          connId: connId,
          options: { signal: this.createAbortSignal() },
        }),
      "getServerVersion",
      this.errorHandler,
      ""
    );
  }

  async getSystemStatus(): Promise<SystemMetrics> {
    const metrics = await invokeWithAbortHandling(
      () => this.tauriBridge.invoke<SystemMetrics>("get_system_status", {}),
      "getSystemStatus",
      this.errorHandler
    );
    this.dataStore.updateSystemMetrics(metrics);
    return metrics;
  }

  async updateConnection(id: string, config: ConnectionConfig): Promise<void> {
    await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<void>("update_connection", {
          id,
          config,
          options: { signal: this.createAbortSignal() },
        }),
      "updateConnection",
      this.errorHandler
    );
    await this.connectionsApi.listConnectionsWithRefresh();
  }

  async renameCollection(connId: string, oldName: string, newName: string): Promise<void> {
    await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<void>("rename_collection", {
          connId: connId,
          oldName: oldName,
          newName: newName,
          options: { signal: this.createAbortSignal() },
        }),
      "renameCollection",
      this.errorHandler
    );
  }

  async renameDatabase(connId: string, oldName: string, newName: string): Promise<void> {
    await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<void>("rename_database", {
          connId: connId,
          oldName: oldName,
          newName: newName,
          options: { signal: this.createAbortSignal() },
        }),
      "renameDatabase",
      this.errorHandler
    );
  }

  async deleteDatabase(connId: string, name: string): Promise<void> {
    await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<void>("delete_database", {
          connId: connId,
          name,
          options: { signal: this.createAbortSignal() },
        }),
      "deleteDatabase",
      this.errorHandler
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
    await invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<void>("create_index", {
          connId: connId,
          collection,
          indexDef,
          options: { signal: this.createAbortSignal() },
        }),
      "createIndex",
      this.errorHandler,
      undefined
    );
  }

  async dropIndex(connId: string, collection: string, indexName: string): Promise<void> {
    await invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<void>("drop_index", {
          connId: connId,
          collection,
          indexName,
          options: { signal: this.createAbortSignal() },
        }),
      "dropIndex",
      this.errorHandler,
      undefined
    );
  }

  async rebuildIndex(connId: string, collection: string, indexName: string): Promise<void> {
    await invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<void>("rebuild_index", {
          connId: connId,
          collection,
          indexName,
          options: { signal: this.createAbortSignal() },
        }),
      "rebuildIndex",
      this.errorHandler,
      undefined
    );
  }
}
