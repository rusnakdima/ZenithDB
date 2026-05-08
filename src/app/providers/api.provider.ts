import { Injectable, inject } from "@angular/core";
import { TauriBridgeService } from "./tauri-bridge.service";
import { RequestCancellationService } from "./request-cancellation.service";
import { ResponseSizeGuardService } from "./response-size-guard.service";
import { StorageService } from "@services/core/storage.service";
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
  DatabaseMeta,
} from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class ApiProvider {
  private tauriBridge = inject(TauriBridgeService);
  private cancellation = inject(RequestCancellationService);
  private responseSizeGuard = inject(ResponseSizeGuardService);

  private storage = inject(StorageService);
  private toastService: ToastService | null = null;
  private errorHandler = inject(ErrorHandlerService);

  private getAbortSignal() {
    return this.cancellation.getAbortSignal();
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

  private checkResponseSize(data: unknown) {
    return this.responseSizeGuard.checkResponseSize(data);
  }

  async listConnections(): Promise<ConnectionSummary[]> {
    const connections = await invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<ConnectionSummary[]>("list_connections", {
          options: { signal: this.createAbortSignal() },
        }),
      "listConnections",
      this.errorHandler,
      []
    );
    this.storage.setConnections(connections);
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

  async saveConnection(config: ConnectionConfig): Promise<string> {
    const id = await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<string>("save_connection", {
          config,
          options: { signal: this.getAbortSignal() },
        }),
      "saveConnection",
      this.errorHandler
    );
    await this.listConnections();
    return id;
  }

  async deleteConnection(id: string): Promise<void> {
    await invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<void>("delete_connection", {
          id,
          options: { signal: this.getAbortSignal() },
        }),
      "deleteConnection",
      this.errorHandler,
      undefined
    );
    this.storage.removeConnection(id);
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
    const collections = await invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<CollectionMeta[]>("list_collections", {
          connId,
          dbName,
          options: { signal: this.getAbortSignal() },
        }),
      "listCollections",
      this.errorHandler,
      []
    );
    this.storage.setCollections(collections);
    return collections;
  }

  async listDatabases(connId: string): Promise<DatabaseMeta[]> {
    return invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<DatabaseMeta[]>("list_databases", {
          connId,
          options: { signal: this.getAbortSignal() },
        }),
      "listDatabases",
      this.errorHandler,
      []
    );
  }

  async createDatabase(connId: string, name: string): Promise<void> {
    await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<void>("create_database", {
          connId,
          name,
          options: { signal: this.getAbortSignal() },
        }),
      "createDatabase",
      this.errorHandler
    );
  }

  async listDatabasesForUri(providerType: string, uri: string): Promise<DatabaseMeta[]> {
    return invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<DatabaseMeta[]>("list_databases_for_uri", {
          providerType,
          uri,
          options: { signal: this.getAbortSignal() },
        }),
      "listDatabasesForUri",
      this.errorHandler,
      []
    );
  }

  async describeCollection(connId: string, collection: string): Promise<CollectionSchema> {
    return invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<CollectionSchema>("describe_collection", {
          connId,
          collection,
          options: { signal: this.getAbortSignal() },
        }),
      "describeCollection",
      this.errorHandler
    );
  }

  async getCollectionStats(connId: string, collection: string): Promise<CollectionStats> {
    return invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<CollectionStats>("get_collection_stats", {
          connId,
          collection,
          options: { signal: this.getAbortSignal() },
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
          connId,
          collection,
          query: params,
          options: { signal: this.getAbortSignal() },
        }),
      "queryData",
      this.errorHandler
    );
    const sizeCheck = this.checkResponseSize(result.data);
    if (sizeCheck.truncated) {
      this.getToastService().warning(sizeCheck.message!);
      const maxItems = this.responseSizeGuard.getMaxItems();
      if (result.data.length > maxItems) {
        result.data = result.data.slice(0, maxItems) as RowData[];
      }
    }
    return result as QueryResult<RowData>;
  }

  async saveRow(connId: string, collection: string, data: RowData): Promise<RowData | null> {
    return invokeWithAbortHandlingOrDefault(
      () =>
        this.tauriBridge.invoke<RowData>("save_row", {
          connId,
          collection,
          data,
          options: { signal: this.getAbortSignal() },
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
          connId,
          collection,
          id,
          options: { signal: this.getAbortSignal() },
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
          connId,
          name,
          options: { signal: this.getAbortSignal() },
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
          connId,
          name,
          options: { signal: this.getAbortSignal() },
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
          connId,
          sql,
          options: { signal: this.getAbortSignal() },
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
          connId,
          options: { signal: this.getAbortSignal() },
        }),
      "getServerVersion",
      this.errorHandler,
      ""
    );
  }

  async getSystemStatus(): Promise<SystemMetrics> {
    const metrics = await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<SystemMetrics>("get_system_status", {
          options: { signal: this.getAbortSignal() },
        }),
      "getSystemStatus",
      this.errorHandler
    );
    this.storage.setSystemMetrics(metrics);
    return metrics;
  }

  async updateConnection(id: string, config: ConnectionConfig): Promise<void> {
    await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<void>("update_connection", {
          id,
          config,
          options: { signal: this.getAbortSignal() },
        }),
      "updateConnection",
      this.errorHandler
    );
  }

  async renameCollection(connId: string, oldName: string, newName: string): Promise<void> {
    await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<void>("rename_collection", {
          conn_id: connId,
          old_name: oldName,
          new_name: newName,
          options: { signal: this.getAbortSignal() },
        }),
      "renameCollection",
      this.errorHandler
    );
  }

  async renameDatabase(connId: string, oldName: string, newName: string): Promise<void> {
    await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<void>("rename_database", {
          conn_id: connId,
          old_name: oldName,
          new_name: newName,
          options: { signal: this.getAbortSignal() },
        }),
      "renameDatabase",
      this.errorHandler
    );
  }

  async deleteDatabase(connId: string, name: string): Promise<void> {
    await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<void>("delete_database", {
          conn_id: connId,
          name,
          options: { signal: this.getAbortSignal() },
        }),
      "deleteDatabase",
      this.errorHandler
    );
  }
}
