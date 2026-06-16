import { Injectable, inject } from "@angular/core";
import { TauriBridgeService } from "./tauri-bridge.service";
import { RequestCancellationService } from "./request-cancellation.service";
import { DataStoreService } from "@app/shared/services/core/unified-storage.service";
import { ConnectionsApiService } from "@shared/services/connections-api.service";
import { ToastService } from "@services/toast.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { getLoggingService } from "@tauri-apps/logger";
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
  private logger = getLoggingService();

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

  async getAuditLog(
    connId: string,
    filter?: {
      operations?: string[];
      collection?: string;
      startDate?: string;
      endDate?: string;
      searchQuery?: string;
    }
  ): Promise<
    {
      id: string;
      timestamp: string;
      operation: string;
      collection: string;
      documentId: string;
      user?: string;
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    }[]
  > {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "getAuditLog", "get_audit_log", { connId, filter });
    try {
      const result = await this.tauriBridge.invoke<
        {
          id: string;
          timestamp: string;
          operation: string;
          collection: string;
          documentId: string;
          user?: string;
          before?: Record<string, unknown>;
          after?: Record<string, unknown>;
        }[]
      >(
        "get_audit_log",
        { connId, filter },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "getAuditLog",
        "get_audit_log",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "getAuditLog",
        "get_audit_log",
        String(err),
        duration
      );
      throw err;
    }
  }

  async beginTransaction(
    connId: string,
    isolationLevel?: string
  ): Promise<{ transactionId: string }> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "beginTransaction", "begin_transaction", {
      connId,
      isolationLevel,
    });
    try {
      const result = await this.tauriBridge.invoke<{ transactionId: string }>(
        "begin_transaction",
        { connId, isolationLevel },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "beginTransaction",
        "begin_transaction",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
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
    this.dataflowLogger.logApiCall(this.page, "commitTransaction", "commit_transaction", {
      transactionId,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "commit_transaction",
        { transactionId },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "commitTransaction",
        "commit_transaction",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
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
    this.dataflowLogger.logApiCall(this.page, "rollbackTransaction", "rollback_transaction", {
      transactionId,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "rollback_transaction",
        { transactionId },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "rollbackTransaction",
        "rollback_transaction",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "rollbackTransaction",
        "rollback_transaction",
        String(err),
        duration
      );
      throw err;
    }
  }

  async insertDocument(connId: string, collection: string, data: RowData): Promise<RowData | null> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "insertDocument", "insert_document", {
      connId,
      collection,
      data,
    });
    try {
      const result = await this.tauriBridge.invoke<RowData>(
        "insert_document",
        { connId, collection, data },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "insertDocument",
        "insert_document",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "insertDocument",
        "insert_document",
        String(err),
        duration
      );
      throw err;
    }
  }

  async updateDocument(
    connId: string,
    collection: string,
    id: string,
    data: RowData
  ): Promise<RowData | null> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "updateDocument", "update_document", {
      connId,
      collection,
      id,
      data,
    });
    try {
      const result = await this.tauriBridge.invoke<RowData>(
        "update_document",
        { connId, collection, id, data },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "updateDocument",
        "update_document",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "updateDocument",
        "update_document",
        String(err),
        duration
      );
      throw err;
    }
  }

  async deleteDocument(connId: string, collection: string, id: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "deleteDocument", "delete_document", {
      connId,
      collection,
      id,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "delete_document",
        { connId, collection, id },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "deleteDocument",
        "delete_document",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "deleteDocument",
        "delete_document",
        String(err),
        duration
      );
      throw err;
    }
  }

  async softDeleteDocument(connId: string, collection: string, id: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "softDeleteDocument", "soft_delete_document", {
      connId,
      collection,
      id,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "soft_delete_document",
        { connId, collection, id },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "softDeleteDocument",
        "soft_delete_document",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "softDeleteDocument",
        "soft_delete_document",
        String(err),
        duration
      );
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

  async createIndex(connId: string, collection: string, indexDef: unknown): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "createIndex", "create_index", {
      connId,
      collection,
      indexDef,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "create_index",
        { connId: connId, collection, index_definition: indexDef },
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

  async createDatabase(connId: string, name: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "createDatabase", "create_database", {
      connId,
      name,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "create_database",
        { connection_id: connId, name },
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
    this.dataflowLogger.logApiCall(this.page, "describeCollection", "collection_describe", {
      connId,
      collection,
    });
    try {
      const result = await this.tauriBridge.invoke<CollectionSchema>(
        "collection_describe",
        { connection_id: connId, name: collection },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "describeCollection",
        "collection_describe",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "describeCollection",
        "collection_describe",
        String(err),
        duration
      );
      throw err;
    }
  }

  async getCollectionStats(connId: string, collection: string): Promise<CollectionStats> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "getCollectionStats", "collection_stats", {
      connId,
      collection,
    });
    try {
      const result = await this.tauriBridge.invoke<CollectionStats>(
        "collection_stats",
        { connection_id: connId, name: collection },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "getCollectionStats",
        "collection_stats",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "getCollectionStats",
        "collection_stats",
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
    this.dataflowLogger.logApiCall(this.page, "queryData", "query_execute", {
      connId,
      collection,
      params,
    });
    try {
      const result = await this.tauriBridge.invoke<QueryResult<RowData>>(
        "query_execute",
        { connection_id: connId, collection, params },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(this.page, "queryData", "query_execute", result, duration);
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(this.page, "queryData", "query_execute", String(err), duration);
      throw err;
    }
  }

  async saveRow(
    connId: string,
    collection: string,
    data: Record<string, unknown>
  ): Promise<RowData | null> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "saveRow", "query_save", {
      connId,
      collection,
      data,
    });
    try {
      const result = await this.tauriBridge.invoke<RowData>(
        "query_save",
        { connection_id: connId, collection, data },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(this.page, "saveRow", "query_save", result, duration);
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(this.page, "saveRow", "query_save", String(err), duration);
      throw err;
    }
  }

  async deleteRow(connId: string, collection: string, id: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "deleteRow", "query_delete", {
      connId,
      collection,
      id,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "query_delete",
        { connection_id: connId, collection, id },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "deleteRow",
        "query_delete",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(this.page, "deleteRow", "query_delete", String(err), duration);
      throw err;
    }
  }

  async createCollection(connId: string, name: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "createCollection", "collection_create", {
      connId,
      name,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "collection_create",
        { connection_id: connId, name },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "createCollection",
        "collection_create",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "createCollection",
        "collection_create",
        String(err),
        duration
      );
      throw err;
    }
  }

  async dropCollection(connId: string, name: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "dropCollection", "collection_drop", {
      connId,
      name,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "collection_drop",
        { connection_id: connId, name },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "dropCollection",
        "collection_drop",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "dropCollection",
        "collection_drop",
        String(err),
        duration
      );
      throw err;
    }
  }

  async renameCollection(connId: string, oldName: string, newName: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "renameCollection", "collection_rename", {
      connId,
      oldName,
      newName,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "collection_rename",
        { connection_id: connId, old_name: oldName, new_name: newName },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "renameCollection",
        "collection_rename",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "renameCollection",
        "collection_rename",
        String(err),
        duration
      );
      throw err;
    }
  }

  async renameDatabase(connId: string, oldName: string, newName: string): Promise<void> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "renameDatabase", "rename_database", {
      connId,
      oldName,
      newName,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "rename_database",
        { connection_id: connId, old_name: oldName, new_name: newName },
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
        { connection_id: connId, name },
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

  async executeRaw(connId: string, sql: string): Promise<RawResult> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "executeRaw", "query_raw", { connId, sql });
    try {
      const result = await this.tauriBridge.invoke<RawResult>(
        "query_raw",
        { connection_id: connId, sql },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(this.page, "executeRaw", "query_raw", result, duration);
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(this.page, "executeRaw", "query_raw", String(err), duration);
      throw err;
    }
  }

  async getServerVersion(connId: string): Promise<string> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "getServerVersion", "query_server_version", {
      connId,
    });
    try {
      const result = await this.tauriBridge.invoke<string>(
        "query_server_version",
        { connection_id: connId },
        { signal: this.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "getServerVersion",
        "query_server_version",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "getServerVersion",
        "query_server_version",
        String(err),
        duration
      );
      throw err;
    }
  }
}
