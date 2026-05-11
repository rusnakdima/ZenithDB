import { Injectable, inject } from "@angular/core";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { LoadingService } from "@shared/services/loading.service";
import { withConnectionAndLoading, withLoading } from "@shared/utils/api-wrapper.util";
import { TauriBridgeService } from "@providers/tauri-bridge.service";
import { DataStoreService } from "@services/core/data-store.service";
import { RequestCancellationService } from "@providers/request-cancellation.service";
import { ResponseSizeGuardService } from "@providers/response-size-guard.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import {
  invokeWithAbortHandling,
  invokeWithAbortHandlingOrDefault,
} from "@shared/utils/invoke-wrapper.util";
import { ToastService } from "@services/toast.service";
import {
  ConnectionSummary,
  ConnectionConfig,
  ConnectionConfigResult,
  ConnectionConfigEnum,
  TestConnectionConfig,
  ConnectionHealth,
  CollectionMeta,
  CollectionSchema,
  CollectionStats,
  QueryParams,
  QueryResult,
  RowData,
  RawResult,
  SystemMetrics,
  DatabaseMeta,
} from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class DatabaseService {
  private connectionState = inject(ConnectionStateService);
  private loadingService = inject(LoadingService);
  private tauriBridge = inject(TauriBridgeService);
  private cancellation = inject(RequestCancellationService);
  private responseSizeGuard = inject(ResponseSizeGuardService);
  private errorHandler = inject(ErrorHandlerService);
  private dataStore = inject(DataStoreService);
  private toastService = inject(ToastService);

  private getAbortSignal() {
    return this.cancellation.getAbortSignal();
  }

  private getFastAbortSignal() {
    return this.cancellation.getFastAbortSignal();
  }

  private createAbortSignal() {
    return this.cancellation.createAbortSignal();
  }

  private checkResponseSize(data: unknown) {
    return this.responseSizeGuard.checkResponseSize(data);
  }

  private isNetworkProvider(config: TestConnectionConfig): boolean {
    const configType = config.config.type;
    return configType !== "Json" && configType !== "Sqlite";
  }

  async listConnections(): Promise<ConnectionSummary[]> {
    return withLoading(this.loadingService, "Loading connections...", async () => {
      const connections = await invokeWithAbortHandlingOrDefault(
        () =>
          this.tauriBridge.invoke<ConnectionSummary[]>("list_connections", {
            options: { signal: this.createAbortSignal() },
          }),
        "listConnections",
        this.errorHandler,
        []
      );
      this.dataStore.updateConnections(connections);
      return connections;
    });
  }

  async getConnection(id: string): Promise<ConnectionConfigResult> {
    return withLoading(this.loadingService, "Loading connection...", () =>
      invokeWithAbortHandling(
        () =>
          this.tauriBridge.invoke<ConnectionConfigResult>("get_connection", {
            id,
            options: { signal: this.getFastAbortSignal() },
          }),
        "getConnection",
        this.errorHandler
      )
    );
  }

  async saveConnection(config: ConnectionConfig): Promise<string> {
    return withLoading(this.loadingService, "Saving connection...", async () => {
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
    });
  }

  async deleteConnection(id: string): Promise<void> {
    return withLoading(this.loadingService, "Deleting connection...", async () => {
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
      this.dataStore.removeConnection(id);
    });
  }

  async testConnection(config: TestConnectionConfig): Promise<ConnectionHealth> {
    return withLoading(this.loadingService, "Testing connection...", async () => {
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
          this.toastService.error(msg);
          throw new Error(msg);
        }
        const msg = e instanceof Error ? e.message : String(e);
        this.toastService.error(`Connection failed: ${msg}`);
        throw e;
      }
    });
  }

  async testConnectionById(connId: string): Promise<ConnectionHealth | null> {
    try {
      const fullConn = await this.getConnection(connId);
      const config = {
        name: fullConn.config.name,
        config: fullConn.config.config,
      };
      return await this.testConnection(config);
    } catch (e) {
      console.error("Failed to test connection:", e);
      return null;
    }
  }

  async testConnectionStatus(connId: string): Promise<ConnectionSummary | null> {
    try {
      return await this.tauriBridge.invoke<ConnectionSummary>("test_connection_status", {
        id: connId,
        options: { signal: this.createAbortSignal() },
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        const msg = "Connection timed out";
        this.toastService.error(msg);
        throw new Error(msg);
      }
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(msg);
    }
  }

  async listCollections(connId?: string, dbName?: string): Promise<CollectionMeta[]> {
    const id = connId || this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      id,
      this.loadingService,
      "Loading collections...",
      async (connId) => {
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
        this.dataStore.updateCollections(connId, collections);
        return collections;
      }
    );
  }

  async listDatabases(connId?: string): Promise<DatabaseMeta[]> {
    const id = connId || this.connectionState.activeConnectionId();
    return withConnectionAndLoading(id, this.loadingService, "Loading databases...", (connId) =>
      invokeWithAbortHandlingOrDefault(
        () =>
          this.tauriBridge.invoke<DatabaseMeta[]>("list_databases", {
            connId,
            options: { signal: this.getAbortSignal() },
          }),
        "listDatabases",
        this.errorHandler,
        []
      )
    );
  }

  async createDatabase(name: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Creating database ${name}...`,
      (connId) =>
        invokeWithAbortHandling(
          () =>
            this.tauriBridge.invoke<void>("create_database", {
              connId,
              name,
              options: { signal: this.getAbortSignal() },
            }),
          "createDatabase",
          this.errorHandler
        )
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

  async describeCollection(collection: string): Promise<CollectionSchema> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Describing ${collection}...`,
      (connId) =>
        invokeWithAbortHandling(
          () =>
            this.tauriBridge.invoke<CollectionSchema>("describe_collection", {
              connId,
              collection,
              options: { signal: this.getAbortSignal() },
            }),
          "describeCollection",
          this.errorHandler
        )
    );
  }

  async getCollectionStats(collection: string): Promise<CollectionStats> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Loading stats for ${collection}...`,
      (connId) =>
        invokeWithAbortHandling(
          () =>
            this.tauriBridge.invoke<CollectionStats>("get_collection_stats", {
              connId,
              collection,
              options: { signal: this.getAbortSignal() },
            }),
          "getCollectionStats",
          this.errorHandler
        )
    );
  }

  async queryData(collection: string, params: QueryParams): Promise<QueryResult<RowData>> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      "Executing query...",
      async (connId) => {
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
          this.toastService.warning(sizeCheck.message!);
          const maxItems = this.responseSizeGuard.getMaxItems();
          if (result.data.length > maxItems) {
            result.data = result.data.slice(0, maxItems) as RowData[];
          }
        }
        return result as QueryResult<RowData>;
      }
    );
  }

  async saveRow(collection: string, data: Record<string, unknown>): Promise<unknown> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      "Saving row...",
      async (connId) => {
        const result = await invokeWithAbortHandlingOrDefault(
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
        this.dataStore.invalidateCollectionCache(collection);
        return result;
      }
    );
  }

  async deleteRow(collection: string, id: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      "Deleting row...",
      async (connId) => {
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
        this.dataStore.invalidateCollectionCache(collection);
      }
    );
  }

  async createCollection(name: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Creating collection ${name}...`,
      async (connId) => {
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
    );
  }

  async dropCollection(name: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Dropping collection ${name}...`,
      async (connId) => {
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
    );
  }

  async executeRaw(sql: string): Promise<RawResult> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(connId, this.loadingService, "Executing SQL...", (connId) =>
      invokeWithAbortHandlingOrDefault(
        () =>
          this.tauriBridge.invoke<RawResult>("execute_raw", {
            connId,
            sql,
            options: { signal: this.getAbortSignal() },
          }),
        "executeRaw",
        this.errorHandler,
        { columns: [], rows: [], affected_rows: 0 } as RawResult
      )
    );
  }

  async getServerVersion(): Promise<string> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      "Fetching server version...",
      (connId) =>
        invokeWithAbortHandlingOrDefault(
          () =>
            this.tauriBridge.invoke<string>("get_server_version", {
              connId,
              options: { signal: this.getAbortSignal() },
            }),
          "getServerVersion",
          this.errorHandler,
          ""
        )
    );
  }

  async getSystemStatus(): Promise<SystemMetrics> {
    return await invokeWithAbortHandling(
      () =>
        this.tauriBridge.invoke<SystemMetrics>("get_system_status", {
          options: { signal: this.getAbortSignal() },
        }),
      "getSystemStatus",
      this.errorHandler
    );
  }

  async updateConnection(id: string, config: ConnectionConfig): Promise<void> {
    return await invokeWithAbortHandling(
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
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Renaming collection ${oldName} to ${newName}...`,
      (connId) =>
        invokeWithAbortHandling(
          () =>
            this.tauriBridge.invoke<void>("rename_collection", {
              conn_id: connId,
              old_name: oldName,
              new_name: newName,
              options: { signal: this.getAbortSignal() },
            }),
          "renameCollection",
          this.errorHandler
        )
    );
  }

  async renameDatabase(connId: string, oldName: string, newName: string): Promise<void> {
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Renaming database ${oldName} to ${newName}...`,
      (connId) =>
        invokeWithAbortHandling(
          () =>
            this.tauriBridge.invoke<void>("rename_database", {
              conn_id: connId,
              old_name: oldName,
              new_name: newName,
              options: { signal: this.getAbortSignal() },
            }),
          "renameDatabase",
          this.errorHandler
        )
    );
  }

  async deleteDatabase(connId: string, name: string): Promise<void> {
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Deleting database ${name}...`,
      (connId) =>
        invokeWithAbortHandling(
          () =>
            this.tauriBridge.invoke<void>("delete_database", {
              conn_id: connId,
              name,
              options: { signal: this.getAbortSignal() },
            }),
          "deleteDatabase",
          this.errorHandler
        )
    );
  }
}
