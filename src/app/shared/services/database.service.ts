import { Injectable, inject } from "@angular/core";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { DataProviderService } from "@shared/services/data-provider.service";
import { LoadingService } from "@shared/services/loading.service";
import { withConnectionAndLoading, withLoading } from "@shared/utils/api-wrapper.util";
import { ApiProvider } from "@providers/api.provider";
import { StorageService } from "@services/core/storage.service";
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
  private dataProvider = inject(DataProviderService);
  private loadingService = inject(LoadingService);
  private api = inject(ApiProvider);
  private storage = inject(StorageService);

  async listConnections(): Promise<ConnectionSummary[]> {
    return withLoading(this.loadingService, "Loading connections...", () =>
      this.api.listConnections()
    );
  }

  async getConnection(id: string): Promise<ConnectionConfigResult> {
    return withLoading(this.loadingService, "Loading connection...", () =>
      this.api.getConnection(id)
    );
  }

  async saveConnection(config: ConnectionConfig): Promise<string> {
    return withLoading(this.loadingService, "Saving connection...", () =>
      this.api.saveConnection(config)
    );
  }

  async deleteConnection(id: string): Promise<void> {
    return withLoading(this.loadingService, "Deleting connection...", () =>
      this.api.deleteConnection(id)
    );
  }

  async testConnection(config: TestConnectionConfig): Promise<ConnectionHealth> {
    return withLoading(this.loadingService, "Testing connection...", () =>
      this.api.testConnection(config)
    );
  }

  async testConnectionById(connId: string): Promise<ConnectionHealth | null> {
    try {
      const fullConn = await this.getConnection(connId);
      const config = {
        name: fullConn.config.name,
        config: fullConn.config.config,
      };
      return await this.api.testConnection(config);
    } catch (e) {
      console.error("Failed to test connection:", e);
      return null;
    }
  }

  async testConnectionStatus(connId: string): Promise<ConnectionSummary | null> {
    try {
      return await this.api.testConnectionStatus(connId);
    } catch (e) {
      return null;
    }
  }

  async listCollections(connId?: string, dbName?: string): Promise<CollectionMeta[]> {
    const id = connId || this.connectionState.activeConnectionId();
    return withConnectionAndLoading(id, this.loadingService, "Loading collections...", (connId) =>
      this.api.listCollections(connId, dbName)
    );
  }

  async listDatabases(connId?: string): Promise<DatabaseMeta[]> {
    const id = connId || this.connectionState.activeConnectionId();
    return withConnectionAndLoading(id, this.loadingService, "Loading databases...", (connId) =>
      this.api.listDatabases(connId)
    );
  }

  async createDatabase(name: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Creating database ${name}...`,
      (connId) => this.api.createDatabase(connId, name)
    );
  }

  async listDatabasesForUri(providerType: string, uri: string): Promise<DatabaseMeta[]> {
    return this.api.listDatabasesForUri(providerType, uri);
  }

  async describeCollection(collection: string): Promise<CollectionSchema> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Describing ${collection}...`,
      (connId) => this.api.describeCollection(connId, collection)
    );
  }

  async getCollectionStats(collection: string): Promise<CollectionStats> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Loading stats for ${collection}...`,
      (connId) => this.api.getCollectionStats(connId, collection)
    );
  }

  async queryData(collection: string, params: QueryParams): Promise<QueryResult<RowData>> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(connId, this.loadingService, "Executing query...", (connId) =>
      this.api.queryData(connId, collection, params)
    );
  }

  async saveRow(collection: string, data: Record<string, unknown>): Promise<unknown> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(connId, this.loadingService, "Saving row...", (connId) =>
      this.api.saveRow(connId, collection, data).then((result) => {
        this.dataProvider.invalidateCache(collection);
        return result;
      })
    );
  }

  async deleteRow(collection: string, id: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(connId, this.loadingService, "Deleting row...", (connId) =>
      this.api.deleteRow(connId, collection, id).then(() => {
        this.dataProvider.invalidateCache(collection);
      })
    );
  }

  async createCollection(name: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Creating collection ${name}...`,
      (connId) =>
        this.api.createCollection(connId, name).then(() => {
          this.dataProvider.invalidateColumnsCache();
        })
    );
  }

  async dropCollection(name: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Dropping collection ${name}...`,
      (connId) => this.api.dropCollection(connId, name)
    );
  }

  async executeRaw(sql: string): Promise<RawResult> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(connId, this.loadingService, "Executing SQL...", (connId) =>
      this.api.executeRaw(connId, sql)
    );
  }

  async getServerVersion(): Promise<string> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      "Fetching server version...",
      (connId) => this.api.getServerVersion(connId)
    );
  }

  async getSystemStatus(): Promise<SystemMetrics> {
    return await this.api.getSystemStatus();
  }

  async updateConnection(id: string, config: ConnectionConfig): Promise<void> {
    return await this.api.updateConnection(id, config);
  }

  async renameCollection(connId: string, oldName: string, newName: string): Promise<void> {
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Renaming collection ${oldName} to ${newName}...`,
      (connId) => this.api.renameCollection(connId, oldName, newName)
    );
  }

  async renameDatabase(connId: string, oldName: string, newName: string): Promise<void> {
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Renaming database ${oldName} to ${newName}...`,
      (connId) => this.api.renameDatabase(connId, oldName, newName)
    );
  }

  async deleteDatabase(connId: string, name: string): Promise<void> {
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Deleting database ${name}...`,
      (connId) => this.api.deleteDatabase(connId, name)
    );
  }
}
