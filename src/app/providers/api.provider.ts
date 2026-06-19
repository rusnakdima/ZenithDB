import { Injectable, inject, Injector } from "@angular/core";
import { TauriBridgeService } from "./tauri-bridge.service";
import { RequestCancellationService } from "./request-cancellation.service";
import { DataStoreService } from "@core/services/unified-storage.service";
import { ConnectionsApiService } from "@services/connections-api.service";
import { CollectionsApiService } from "@services/collections-api.service";
import { QueryApiService } from "@services/query-api.service";
import { TransactionApiService } from "@services/transaction-api.service";
import { MetricsApiService } from "@services/metrics-api.service";
import { ToastService } from "@services/toast.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { logger } from "@core/services/logger.service";
import {
  ConnectionSummary,
  ConnectionConfig,
  ConnectionConfigResult,
  TestConnectionConfig,
  CollectionMeta,
  CollectionSchema,
  CollectionStats,
  QueryParams,
  QueryResult,
  RawResult,
  RowData,
} from "@app/models/connection.config";

@Injectable({ providedIn: "root" })
export class ApiProvider {
  private tauriBridge = inject(TauriBridgeService);
  private cancellation = inject(RequestCancellationService);
  private injector = inject(Injector);
  private connectionsApi = inject(ConnectionsApiService);
  private collectionsApi = inject(CollectionsApiService);
  private queryApi = inject(QueryApiService);
  private transactionApi = inject(TransactionApiService);
  private metricsApi = inject(MetricsApiService);
  private toastService: ToastService | null = null;
  private errorHandler = inject(ErrorHandlerService);
  private dataflowLogger = inject(DataflowLoggerService);

  private readonly page = "ApiProvider";

  private get dataStore(): DataStoreService {
    return this.injector.get(DataStoreService);
  }

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
    return this.connectionsApi.listConnections();
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

  async testConnection(
    config: TestConnectionConfig
  ): Promise<import("@app/models/connection.config").ConnectionHealth> {
    const startTime = performance.now();
    this.dataflowLogger.logApiCall(this.page, "testConnection", "test_connection", { config });
    try {
      const isNetwork = this.isNetworkProvider(config);
      const signal = isNetwork ? this.createAbortSignal() : this.getFastAbortSignal();
      const result = await this.tauriBridge.invoke<
        import("@app/models/connection.config").ConnectionHealth
      >("test_connection", { config }, { signal, suppressError: true });
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
    const result = await this.collectionsApi.listCollectionsWithRefresh(connId, dbName);
    return result.collections;
  }

  async listCollectionsPaginated(
    connId: string,
    dbName?: string,
    offset?: number,
    limit?: number
  ): Promise<{ collections: CollectionMeta[]; hasMore: boolean; totalCount: number }> {
    return this.collectionsApi.listCollections(connId, dbName, offset ?? 0, limit ?? 10);
  }

  async getSystemStatus(): Promise<import("@app/models/connection.config").SystemMetrics> {
    return this.metricsApi.fetchMetricsWithRefresh();
  }

  async updateConnection(id: string, config: TestConnectionConfig): Promise<void> {
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
    return this.transactionApi.beginTransaction(connId, isolationLevel);
  }

  async commitTransaction(transactionId: string): Promise<void> {
    return this.transactionApi.commitTransaction(transactionId);
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    return this.transactionApi.rollbackTransaction(transactionId);
  }

  async insertDocument(connId: string, collection: string, data: RowData): Promise<RowData | null> {
    return this.queryApi.insertDocument(connId, collection, data);
  }

  async updateDocument(
    connId: string,
    collection: string,
    id: string,
    data: RowData
  ): Promise<RowData | null> {
    return this.queryApi.updateDocument(connId, collection, id, data);
  }

  async deleteDocument(connId: string, collection: string, id: string): Promise<void> {
    return this.queryApi.deleteDocument(connId, collection, id);
  }

  async softDeleteDocument(connId: string, collection: string, id: string): Promise<void> {
    return this.queryApi.softDeleteDocument(connId, collection, id);
  }

  async rebuildIndex(connId: string, collection: string, indexName: string): Promise<void> {
    return this.queryApi.rebuildIndex(connId, collection, indexName);
  }

  async createIndex(connId: string, collection: string, indexDef: unknown): Promise<void> {
    return this.queryApi.createIndex(connId, collection, indexDef);
  }

  async dropIndex(connId: string, collection: string, indexName: string): Promise<void> {
    return this.queryApi.dropIndex(connId, collection, indexName);
  }

  async createDatabase(connId: string, name: string): Promise<void> {
    return this.collectionsApi.createDatabase(connId, name);
  }

  async describeCollection(connId: string, collection: string): Promise<CollectionSchema> {
    return this.collectionsApi.describeCollection(connId, collection);
  }

  async getCollectionStats(connId: string, collection: string): Promise<CollectionStats> {
    return this.collectionsApi.getCollectionStats(connId, collection);
  }

  async queryData(
    connId: string,
    collection: string,
    params: QueryParams
  ): Promise<QueryResult<RowData>> {
    return this.queryApi.queryData(connId, collection, params);
  }

  async saveRow(
    connId: string,
    collection: string,
    data: Record<string, unknown>
  ): Promise<RowData | null> {
    return this.queryApi.saveRow(connId, collection, data);
  }

  async deleteRow(connId: string, collection: string, id: string): Promise<void> {
    return this.queryApi.deleteRow(connId, collection, id);
  }

  async createCollection(connId: string, name: string): Promise<void> {
    return this.collectionsApi.createCollection(connId, name);
  }

  async dropCollection(connId: string, name: string): Promise<void> {
    return this.collectionsApi.dropCollection(connId, name);
  }

  async renameCollection(connId: string, oldName: string, newName: string): Promise<void> {
    return this.collectionsApi.renameCollection(connId, oldName, newName);
  }

  async renameDatabase(connId: string, oldName: string, newName: string): Promise<void> {
    return this.collectionsApi.renameDatabase(connId, oldName, newName);
  }

  async deleteDatabase(connId: string, name: string): Promise<void> {
    return this.collectionsApi.deleteDatabase(connId, name);
  }

  async executeRaw(connId: string, sql: string): Promise<RawResult> {
    return this.queryApi.executeRaw(connId, sql);
  }

  async getServerVersion(connId: string): Promise<string> {
    return this.queryApi.getServerVersion(connId);
  }
}
