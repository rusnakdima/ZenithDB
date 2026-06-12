import { Injectable, inject } from "@angular/core";
import { TauriBridgeService } from "./tauri-bridge.service";
import { RequestCancellationService } from "./request-cancellation.service";
import { DataStoreService } from "@app/services/core/data-store.service";
import { ConnectionsApiService } from "@shared/services/connections-api.service";
import { ToastService } from "@services/toast.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { AppLoggerService } from "@shared/services/app-logger.service";
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
  private dataflowLogger = inject(DataflowLoggerService);
  private logger = inject(AppLoggerService);

  private readonly page = "ApiProvider";

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
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "listConnections", "list_connections", {});
    try {
      const result = await this.tauriBridge.invoke<ConnectionSummary[]>(
        "list_connections",
        {},
        { suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "listConnections",
        "list_connections",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "listConnections",
        "list_connections",
        String(err),
        duration
      );
      this.logger.error("[API]", "listConnections failed", { error: String(err) });
      throw err;
    }
  }

  async getConnection(id: string): Promise<ConnectionConfigResult> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "getConnection", "get_connection", { id });
    try {
      const result = await this.tauriBridge.invoke<ConnectionConfigResult>(
        "get_connection",
        { id },
        { signal: this.getFastAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "getConnection",
        "get_connection",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "getConnection",
        "get_connection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async testConnectionStatus(id: string): Promise<ConnectionSummary> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "testConnectionStatus", "test_connection_status", {
      id,
    });
    try {
      const result = await this.tauriBridge.invoke<ConnectionSummary>(
        "test_connection_status",
        { id },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "testConnectionStatus",
        "test_connection_status",
        result,
        duration
      );
      return result;
    } catch (e) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "testConnectionStatus",
        "test_connection_status",
        String(e),
        duration
      );
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
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "saveConnection", "save_connection", { config });
    try {
      const id = await this.tauriBridge.invoke<string>(
        "save_connection",
        { config },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "saveConnection",
        "save_connection",
        { id },
        duration
      );
      await this.connectionsApi.listConnectionsWithRefresh();
      return id;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "saveConnection",
        "save_connection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async deleteConnection(id: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "deleteConnection", "delete_connection", { id });
    try {
      await this.tauriBridge.invoke<void>(
        "delete_connection",
        { id },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "deleteConnection",
        "delete_connection",
        { success: true },
        duration
      );
      this.dataStore.removeConnection(id);
      await this.connectionsApi.listConnectionsWithRefresh();
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "deleteConnection",
        "delete_connection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async testConnection(config: TestConnectionConfig): Promise<ConnectionHealth> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "testConnection", "test_connection", { config });
    try {
      const isNetwork = this.isNetworkProvider(config);
      const signal = isNetwork ? this.createAbortSignal() : this.getFastAbortSignal();
      const result = await this.tauriBridge.invoke<ConnectionHealth>(
        "test_connection",
        { config },
        { signal, suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "testConnection",
        "test_connection",
        result,
        duration
      );
      return result;
    } catch (e) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "testConnection",
        "test_connection",
        String(e),
        duration
      );
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
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "listCollections", "collection_list", {
      connId,
      dbName,
    });
    try {
      const result = await this.tauriBridge.invoke<{
        collections: CollectionMeta[];
        has_more: boolean;
        total_count: number;
      }>(
        "collection_list",
        { connId: connId, db_name: dbName },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "listCollections",
        "collection_list",
        result,
        duration
      );
      this.dataStore.updateCollections(connId, result.collections);
      return result.collections;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "listCollections",
        "collection_list",
        String(err),
        duration
      );
      throw err;
    }
  }

  async listCollectionsPaginated(
    connId: string,
    dbName?: string,
    offset?: number,
    limit?: number
  ): Promise<{ collections: CollectionMeta[]; hasMore: boolean; totalCount: number }> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "listCollectionsPaginated", "collection_list", {
      connId,
      dbName,
      offset,
      limit,
    });
    try {
      const result = await this.tauriBridge.invoke<{
        collections: CollectionMeta[];
        has_more: boolean;
        total_count: number;
      }>(
        "collection_list",
        { connId: connId, db_name: dbName, offset, limit },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "listCollectionsPaginated",
        "collection_list",
        result,
        duration
      );
      return {
        collections: result.collections,
        hasMore: result.has_more,
        totalCount: result.total_count,
      };
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "listCollectionsPaginated",
        "collection_list",
        String(err),
        duration
      );
      throw err;
    }
  }

  async createDatabase(connId: string, name: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "createDatabase", "create_database", {
      connId,
      name,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "create_database",
        { connId: connId, name },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "createDatabase",
        "create_database",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "createDatabase",
        "create_database",
        String(err),
        duration
      );
      throw err;
    }
  }

  async describeCollection(connId: string, collection: string): Promise<CollectionSchema> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "describeCollection", "describe_collection", {
      connId,
      collection,
    });
    try {
      const result = await this.tauriBridge.invoke<CollectionSchema>(
        "describe_collection",
        { connId: connId, collection },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "describeCollection",
        "describe_collection",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "describeCollection",
        "describe_collection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async getCollectionStats(connId: string, collection: string): Promise<CollectionStats> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "getCollectionStats", "get_collection_stats", {
      connId,
      collection,
    });
    try {
      const result = await this.tauriBridge.invoke<CollectionStats>(
        "get_collection_stats",
        { connId: connId, collection },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "getCollectionStats",
        "get_collection_stats",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "getCollectionStats",
        "get_collection_stats",
        String(err),
        duration
      );
      throw err;
    }
  }

  async queryData(
    connId: string,
    collection: string,
    params: QueryParams
  ): Promise<QueryResult<RowData>> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "queryData", "query_data", {
      connId,
      collection,
      params,
    });
    try {
      const result = await this.tauriBridge.invoke<QueryResult<unknown>>(
        "query_data",
        { connId: connId, collection, query: params },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logQueryData(
        this.page,
        "queryData",
        "query_data",
        { connId, collection, params },
        result,
        duration
      );
      return result as QueryResult<RowData>;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(this.page, "queryData", "query_data", String(err), duration);
      throw err;
    }
  }

  async saveRow(connId: string, collection: string, data: RowData): Promise<RowData | null> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "saveRow", "save_row", { connId, collection, data });
    try {
      const result = await this.tauriBridge.invoke<RowData>(
        "save_row",
        { connId: connId, collection, data },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(this.page, "saveRow", "save_row", result, duration);
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(this.page, "saveRow", "save_row", String(err), duration);
      throw err;
    }
  }

  async deleteRow(connId: string, collection: string, id: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "deleteRow", "delete_row", {
      connId,
      collection,
      id,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "delete_row",
        { connId: connId, collection, id },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "deleteRow",
        "delete_row",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(this.page, "deleteRow", "delete_row", String(err), duration);
      throw err;
    }
  }

  async createCollection(connId: string, name: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "createCollection", "create_collection", {
      connId,
      name,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "create_collection",
        { connId: connId, name },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "createCollection",
        "create_collection",
        { success: true },
        duration
      );
      await this.listCollections(connId);
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "createCollection",
        "create_collection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async dropCollection(connId: string, name: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "dropCollection", "drop_collection", {
      connId,
      name,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "drop_collection",
        { connId: connId, name },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "dropCollection",
        "drop_collection",
        { success: true },
        duration
      );
      await this.listCollections(connId);
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "dropCollection",
        "drop_collection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async executeRaw(connId: string, sql: string): Promise<RawResult> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "executeRaw", "execute_raw", { connId, sql });
    try {
      const result = await this.tauriBridge.invoke<RawResult>(
        "execute_raw",
        { connId: connId, sql },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(this.page, "executeRaw", "execute_raw", result, duration);
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(this.page, "executeRaw", "execute_raw", String(err), duration);
      throw err;
    }
  }

  async getServerVersion(connId: string): Promise<string> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "getServerVersion", "get_server_version", { connId });
    try {
      const result = await this.tauriBridge.invoke<string>(
        "get_server_version",
        { connId: connId },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "getServerVersion",
        "get_server_version",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "getServerVersion",
        "get_server_version",
        String(err),
        duration
      );
      throw err;
    }
  }

  async getSystemStatus(): Promise<SystemMetrics> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "getSystemStatus", "get_system_status", {});
    try {
      const result = await this.tauriBridge.invoke<SystemMetrics>(
        "get_system_status",
        {},
        { suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "getSystemStatus",
        "get_system_status",
        result,
        duration
      );
      this.dataStore.updateSystemMetrics(result);
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "getSystemStatus",
        "get_system_status",
        String(err),
        duration
      );
      throw err;
    }
  }

  async updateConnection(id: string, config: ConnectionConfig): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "updateConnection", "update_connection", {
      id,
      config,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "update_connection",
        { id, config },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "updateConnection",
        "update_connection",
        { success: true },
        duration
      );
      await this.connectionsApi.listConnectionsWithRefresh();
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "updateConnection",
        "update_connection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async renameCollection(connId: string, old_name: string, new_name: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "renameCollection", "rename_collection", {
      connId,
      old_name,
      new_name,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "rename_collection",
        { connId: connId, old_name, new_name },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "renameCollection",
        "rename_collection",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "renameCollection",
        "rename_collection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async renameDatabase(connId: string, old_name: string, new_name: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "renameDatabase", "rename_database", {
      connId,
      old_name,
      new_name,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "rename_database",
        { connId: connId, old_name, new_name },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "renameDatabase",
        "rename_database",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "renameDatabase",
        "rename_database",
        String(err),
        duration
      );
      throw err;
    }
  }

  async deleteDatabase(connId: string, name: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "deleteDatabase", "delete_database", {
      connId,
      name,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "delete_database",
        { connId: connId, name },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "deleteDatabase",
        "delete_database",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "deleteDatabase",
        "delete_database",
        String(err),
        duration
      );
      throw err;
    }
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
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "createIndex", "create_index", {
      connId,
      collection,
      indexDef,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "create_index",
        { connId: connId, collection, indexDef },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "createIndex",
        "create_index",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(this.page, "createIndex", "create_index", String(err), duration);
      throw err;
    }
  }

  async dropIndex(connId: string, collection: string, indexName: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "dropIndex", "drop_index", {
      connId,
      collection,
      indexName,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "drop_index",
        { connId: connId, collection, indexName },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "dropIndex",
        "drop_index",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(this.page, "dropIndex", "drop_index", String(err), duration);
      throw err;
    }
  }

  async rebuildIndex(connId: string, collection: string, indexName: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "rebuildIndex", "rebuild_index", {
      connId,
      collection,
      indexName,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "rebuild_index",
        { connId: connId, collection, indexName },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "rebuildIndex",
        "rebuild_index",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "rebuildIndex",
        "rebuild_index",
        String(err),
        duration
      );
      throw err;
    }
  }
}
