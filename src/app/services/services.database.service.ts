import { Injectable, inject } from "@angular/core";
import { ConnectionStateService } from "@services/services.connection-state.service";
import { ApiProvider } from "@providers/providers.api.provider";
import { ConnectionService } from "@services/services.connection.service";
import { QueryService } from "@services/services.query.service";
import { SchemaService } from "@services/services.schema.service";
import { AdminService } from "@services/admin.service";
import {
  SystemMetrics,
  ConnectionConfigEnum,
  ConnectionConfig,
  ConnectionConfigResult,
  QueryParams,
  TestConnectionConfig,
} from "@entities/entities.connection.config";
@Injectable({ providedIn: "root" })
export class DatabaseService {
  private connectionState = inject(ConnectionStateService);
  private api = inject(ApiProvider);

  connectionService = inject(ConnectionService);
  queryService = inject(QueryService);
  schemaService = inject(SchemaService);
  adminService = inject(AdminService);

  async listConnections() {
    const startTime = performance.now();
    const result = await this.connectionService.listConnections();
    return result;
  }

  async getConnection(id: string): Promise<ConnectionConfigResult> {
    const startTime = performance.now();
    const result = await this.connectionService.getConnection(id);
    return result;
  }

  async saveConnection(config: TestConnectionConfig) {
    const startTime = performance.now();
    const result = await this.connectionService.saveConnection(config);
    return result;
  }

  async deleteConnection(id: string) {
    const startTime = performance.now();
    await this.connectionService.deleteConnection(id);
  }

  async testConnection(config: TestConnectionConfig) {
    const startTime = performance.now();
    const result = await this.connectionService.testConnection(config);
    return result;
  }

  async testConnectionById(connId: string) {
    const startTime = performance.now();
    const result = await this.connectionService.testConnectionById(connId);
    return result;
  }

  async testConnectionStatus(connId: string) {
    const startTime = performance.now();
    const result = await this.connectionService.testConnectionStatus(connId);
    return result;
  }

  async updateConnection(id: string, config: TestConnectionConfig) {
    const startTime = performance.now();
    await this.connectionService.updateConnection(id, config);
  }

  async listCollections(connId?: string, dbName?: string) {
    const startTime = performance.now();
    const result = await this.schemaService.listCollections(connId, dbName);
    return result;
  }

  async createDatabase(name: string) {
    const startTime = performance.now();
    const result = await this.schemaService.createDatabase(name);
    return result;
  }

  async describeCollection(collection: string) {
    const startTime = performance.now();
    const result = await this.schemaService.describeCollection(collection);
    return result;
  }

  async getCollectionStats(collection: string) {
    const startTime = performance.now();
    const result = await this.schemaService.getCollectionStats(collection);
    return result;
  }

  async getServerVersion() {
    const startTime = performance.now();
    const result = await this.schemaService.getServerVersion();
    return result;
  }

  async queryData(collection: string, params: QueryParams) {
    const startTime = performance.now();
    const result = await this.queryService.queryData(collection, params);
    return result;
  }

  async saveRow(collection: string, data: Record<string, unknown>) {
    const startTime = performance.now();
    const result = await this.queryService.saveRow(collection, data);
    return result;
  }

  async deleteRow(collection: string, id: string) {
    const startTime = performance.now();
    await this.queryService.deleteRow(collection, id);
  }

  async createCollection(name: string) {
    const startTime = performance.now();
    const result = await this.adminService.createCollection(name);
    return result;
  }

  async dropCollection(name: string) {
    const startTime = performance.now();
    const result = await this.adminService.dropCollection(name);
    return result;
  }

  async executeRaw(sql: string) {
    const startTime = performance.now();
    const result = await this.adminService.executeRaw(sql);
    return result;
  }

  async renameCollection(connId: string, oldName: string, newName: string) {
    const startTime = performance.now();
    const result = await this.adminService.renameCollection(connId, oldName, newName);
    return result;
  }

  async renameDatabase(connId: string, oldName: string, newName: string) {
    const startTime = performance.now();
    const result = await this.adminService.renameDatabase(connId, oldName, newName);
    return result;
  }

  async deleteDatabase(connId: string, name: string) {
    const startTime = performance.now();
    const result = await this.adminService.deleteDatabase(connId, name);
    return result;
  }

  async getSystemStatus(): Promise<SystemMetrics> {
    const startTime = performance.now();
    const result = await this.api.getSystemStatus();
    return result;
  }
}
