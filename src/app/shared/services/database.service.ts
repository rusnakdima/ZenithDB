import { Injectable, inject } from "@angular/core";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ApiProvider } from "@providers/api.provider";
import { ConnectionService } from "@shared/services/connection.service";
import { QueryService } from "@shared/services/query.service";
import { SchemaService } from "@shared/services/schema.service";
import { AdminService } from "@shared/services/admin.service";
import {
  SystemMetrics,
  ConnectionConfigEnum,
  ConnectionConfig,
  QueryParams,
  TestConnectionConfig,
} from "@shared/models/connection.config";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";

@Injectable({ providedIn: "root" })
export class DatabaseService {
  private connectionState = inject(ConnectionStateService);
  private api = inject(ApiProvider);
  private logger = inject(DataflowLoggerService, { optional: true });

  connectionService = inject(ConnectionService);
  queryService = inject(QueryService);
  schemaService = inject(SchemaService);
  adminService = inject(AdminService);

  async listConnections() {
    const startTime = performance.now();
    const result = await this.connectionService.listConnections();
    this.logger?.logDataReceive(
      "database",
      "listConnections",
      "db_list_connections",
      { count: result.length },
      performance.now() - startTime
    );
    return result;
  }

  async getConnection(id: string) {
    const startTime = performance.now();
    const result = await this.connectionService.getConnection(id);
    this.logger?.logDataReceive(
      "database",
      "getConnection",
      "db_get_connection",
      { id },
      performance.now() - startTime
    );
    return result;
  }

  async saveConnection(config: TestConnectionConfig) {
    const startTime = performance.now();
    const result = await this.connectionService.saveConnection(config);
    this.logger?.logDataReceive(
      "database",
      "saveConnection",
      "db_save_connection",
      { name: config.name },
      performance.now() - startTime
    );
    return result;
  }

  async deleteConnection(id: string) {
    const startTime = performance.now();
    await this.connectionService.deleteConnection(id);
    this.logger?.logUserAction("database", "deleteConnection", { id });
  }

  async testConnection(config: TestConnectionConfig) {
    const startTime = performance.now();
    const result = await this.connectionService.testConnection(config);
    this.logger?.logDataReceive(
      "database",
      "testConnection",
      "db_test_connection",
      { healthy: result.healthy },
      performance.now() - startTime
    );
    return result;
  }

  async testConnectionById(connId: string) {
    const startTime = performance.now();
    const result = await this.connectionService.testConnectionById(connId);
    this.logger?.logDataReceive(
      "database",
      "testConnectionById",
      "db_test_connection",
      { connId, healthy: result?.healthy },
      performance.now() - startTime
    );
    return result;
  }

  async testConnectionStatus(connId: string) {
    const startTime = performance.now();
    const result = await this.connectionService.testConnectionStatus(connId);
    this.logger?.logDataReceive(
      "database",
      "testConnectionStatus",
      "db_test_status",
      { connId },
      performance.now() - startTime
    );
    return result;
  }

  async updateConnection(id: string, config: TestConnectionConfig) {
    const startTime = performance.now();
    await this.connectionService.updateConnection(id, config);
    this.logger?.logUserAction("database", "updateConnection", { id });
  }

  async listCollections(connId?: string, dbName?: string) {
    const startTime = performance.now();
    const result = await this.schemaService.listCollections(connId, dbName);
    this.logger?.logDataReceive(
      "database",
      "listCollections",
      "db_list_collections",
      { connId, dbName, count: result.length },
      performance.now() - startTime
    );
    return result;
  }

  async createDatabase(name: string) {
    const startTime = performance.now();
    const result = await this.schemaService.createDatabase(name);
    this.logger?.logUserAction("database", "createDatabase", { name });
    return result;
  }

  async describeCollection(collection: string) {
    const startTime = performance.now();
    const result = await this.schemaService.describeCollection(collection);
    this.logger?.logDataReceive(
      "database",
      "describeCollection",
      "db_describe_collection",
      { collection },
      performance.now() - startTime
    );
    return result;
  }

  async getCollectionStats(collection: string) {
    const startTime = performance.now();
    const result = await this.schemaService.getCollectionStats(collection);
    this.logger?.logDataReceive(
      "database",
      "getCollectionStats",
      "db_collection_stats",
      { collection },
      performance.now() - startTime
    );
    return result;
  }

  async getServerVersion() {
    const startTime = performance.now();
    const result = await this.schemaService.getServerVersion();
    this.logger?.logDataReceive(
      "database",
      "getServerVersion",
      "db_server_version",
      {},
      performance.now() - startTime
    );
    return result;
  }

  async queryData(collection: string, params: QueryParams) {
    const startTime = performance.now();
    const result = await this.queryService.queryData(collection, params);
    this.logger?.logDataReceive(
      "database",
      "queryData",
      "db_query",
      { collection, rowCount: result.data.length },
      performance.now() - startTime
    );
    return result;
  }

  async saveRow(collection: string, data: Record<string, unknown>) {
    const startTime = performance.now();
    const result = await this.queryService.saveRow(collection, data);
    this.logger?.logDataReceive(
      "database",
      "saveRow",
      "db_save_row",
      { collection },
      performance.now() - startTime
    );
    return result;
  }

  async deleteRow(collection: string, id: string) {
    const startTime = performance.now();
    await this.queryService.deleteRow(collection, id);
    this.logger?.logUserAction("database", "deleteRow", { collection, id });
  }

  async createCollection(name: string) {
    const startTime = performance.now();
    const result = await this.adminService.createCollection(name);
    this.logger?.logUserAction("database", "createCollection", { name });
    return result;
  }

  async dropCollection(name: string) {
    const startTime = performance.now();
    const result = await this.adminService.dropCollection(name);
    this.logger?.logUserAction("database", "dropCollection", { name });
    return result;
  }

  async executeRaw(sql: string) {
    const startTime = performance.now();
    const result = await this.adminService.executeRaw(sql);
    this.logger?.logUserAction("database", "executeRaw", { sqlLength: sql.length });
    return result;
  }

  async renameCollection(connId: string, oldName: string, newName: string) {
    const startTime = performance.now();
    const result = await this.adminService.renameCollection(connId, oldName, newName);
    this.logger?.logUserAction("database", "renameCollection", { connId, oldName, newName });
    return result;
  }

  async renameDatabase(connId: string, oldName: string, newName: string) {
    const startTime = performance.now();
    const result = await this.adminService.renameDatabase(connId, oldName, newName);
    this.logger?.logUserAction("database", "renameDatabase", { connId, oldName, newName });
    return result;
  }

  async deleteDatabase(connId: string, name: string) {
    const startTime = performance.now();
    const result = await this.adminService.deleteDatabase(connId, name);
    this.logger?.logUserAction("database", "deleteDatabase", { connId, name });
    return result;
  }

  async getSystemStatus(): Promise<SystemMetrics> {
    const startTime = performance.now();
    const result = await this.api.getSystemStatus();
    this.logger?.logDataReceive(
      "database",
      "getSystemStatus",
      "db_system_status",
      {},
      performance.now() - startTime
    );
    return result;
  }
}
