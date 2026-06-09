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

@Injectable({ providedIn: "root" })
export class DatabaseService {
  private connectionState = inject(ConnectionStateService);
  private api = inject(ApiProvider);

  connectionService = inject(ConnectionService);
  queryService = inject(QueryService);
  schemaService = inject(SchemaService);
  adminService = inject(AdminService);

  async listConnections() {
    return this.connectionService.listConnections();
  }

  async getConnection(id: string) {
    return this.connectionService.getConnection(id);
  }

  async saveConnection(config: TestConnectionConfig) {
    return this.connectionService.saveConnection(config);
  }

  async deleteConnection(id: string) {
    return this.connectionService.deleteConnection(id);
  }

  async testConnection(config: TestConnectionConfig) {
    return this.connectionService.testConnection(config);
  }

  async testConnectionById(connId: string) {
    return this.connectionService.testConnectionById(connId);
  }

  async testConnectionStatus(connId: string) {
    return this.connectionService.testConnectionStatus(connId);
  }

  async updateConnection(id: string, config: ConnectionConfig) {
    return this.connectionService.updateConnection(id, config);
  }

  async listCollections(connId?: string, dbName?: string) {
    return this.schemaService.listCollections(connId, dbName);
  }

  async createDatabase(name: string) {
    return this.schemaService.createDatabase(name);
  }

  async describeCollection(collection: string) {
    return this.schemaService.describeCollection(collection);
  }

  async getCollectionStats(collection: string) {
    return this.schemaService.getCollectionStats(collection);
  }

  async getServerVersion() {
    return this.schemaService.getServerVersion();
  }

  async queryData(collection: string, params: QueryParams) {
    return this.queryService.queryData(collection, params);
  }

  async saveRow(collection: string, data: Record<string, unknown>) {
    return this.queryService.saveRow(collection, data);
  }

  async deleteRow(collection: string, id: string) {
    return this.queryService.deleteRow(collection, id);
  }

  async createCollection(name: string) {
    return this.adminService.createCollection(name);
  }

  async dropCollection(name: string) {
    return this.adminService.dropCollection(name);
  }

  async executeRaw(sql: string) {
    return this.adminService.executeRaw(sql);
  }

  async renameCollection(connId: string, oldName: string, newName: string) {
    return this.adminService.renameCollection(connId, oldName, newName);
  }

  async renameDatabase(connId: string, oldName: string, newName: string) {
    return this.adminService.renameDatabase(connId, oldName, newName);
  }

  async deleteDatabase(connId: string, name: string) {
    return this.adminService.deleteDatabase(connId, name);
  }

  async getSystemStatus(): Promise<SystemMetrics> {
    return await this.api.getSystemStatus();
  }
}
