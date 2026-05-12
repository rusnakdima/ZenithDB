import { Injectable, inject } from "@angular/core";
import { TauriBridgeService } from "./tauri-bridge.service";
import { RequestCancellationService } from "./request-cancellation.service";
import { ResponseSizeGuardService } from "./response-size-guard.service";
import { DataStoreService } from "@app/services/core/data-store.service";
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
  private responseSizeGuard = inject(ResponseSizeGuardService);

  private dataStore = inject(DataStoreService);
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

  private checkResponseSize(data: unknown) {
    return this.responseSizeGuard.checkResponseSize(data);
  }

  async listConnections(): Promise<ConnectionSummary[]> {
    const withTimeout = Promise.race([
      invokeWithAbortHandlingOrDefault(
        () =>
          this.tauriBridge.invoke<ConnectionSummary[]>("list_connections", {
            options: { signal: this.createAbortSignal() },
          }),
        "listConnections",
        this.errorHandler,
        []
      ),
      new Promise<ConnectionSummary[]>((_, reject) =>
        setTimeout(() => reject(new Error("listConnections timeout")), 5000)
      ),
    ]);
    const connections = await withTimeout;
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
    await this.listConnections();
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
          options: { signal: this.createAbortSignal() },
        }),
      "listCollections",
      this.errorHandler,
      []
    );
    this.dataStore.updateCollections(connId, collections);
    return collections;
  }

  async createDatabase(connId: string, name: string): Promise<void> {
    await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<void>("create_database", {
          connId,
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
          connId,
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
          connId,
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
          connId,
          collection,
          query: params,
          options: { signal: this.createAbortSignal() },
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
          connId,
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
          connId,
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
          connId,
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
          connId,
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
          connId,
          options: { signal: this.createAbortSignal() },
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
          options: { signal: this.createAbortSignal() },
        }),
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
  }

  async renameCollection(connId: string, oldName: string, newName: string): Promise<void> {
    await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<void>("rename_collection", {
          conn_id: connId,
          old_name: oldName,
          new_name: newName,
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
          conn_id: connId,
          old_name: oldName,
          new_name: newName,
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
          conn_id: connId,
          name,
          options: { signal: this.createAbortSignal() },
        }),
      "deleteDatabase",
      this.errorHandler
    );
  }
}
