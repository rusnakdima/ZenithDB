import { Injectable, inject } from "@angular/core";
import { ConnectionStateService } from "@shared/services/connection-state.service";
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
  RawResult,
  SystemMetrics,
  DatabaseMeta,
} from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class DatabaseService {
  private connectionState = inject(ConnectionStateService);
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

  async listCollections(): Promise<CollectionMeta[]> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      "Loading collections...",
      (connId) => this.api.listCollections(connId)
    );
  }

  async listDatabases(): Promise<DatabaseMeta[]> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(connId, this.loadingService, "Loading databases...", (connId) =>
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

  async queryData(collection: string, params: QueryParams): Promise<QueryResult> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(connId, this.loadingService, "Executing query...", (connId) =>
      this.api.queryData(connId, collection, params)
    );
  }

  async saveRow(collection: string, data: Record<string, unknown>): Promise<unknown> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(connId, this.loadingService, "Saving row...", (connId) =>
      this.api.saveRow(connId, collection, data)
    );
  }

  async deleteRow(collection: string, id: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(connId, this.loadingService, "Deleting row...", (connId) =>
      this.api.deleteRow(connId, collection, id)
    );
  }

  async createCollection(name: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Creating collection ${name}...`,
      (connId) => this.api.createCollection(connId, name)
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
}
