import { Injectable, inject } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { StorageService } from "@services/core/storage.service";
import { ConnectionSummary, ConnectionConfig, ConnectionHealth, CollectionMeta, CollectionSchema, CollectionStats, QueryParams, QueryResult, RawResult, SystemMetrics } from "@shared/models/connection.config";

export interface CrudOptions {
  visibility?: "private" | "shared" | "public";
  connId?: string;
  collection?: string;
  id?: string;
  filter?: any;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: "root" })
export class ApiProvider {
  private storage = inject(StorageService);

  async listConnections(): Promise<ConnectionSummary[]> {
    const connections = await invoke<ConnectionSummary[]>("list_connections");
    this.storage.setConnections(connections);
    return connections;
  }

  async getConnection(id: string): Promise<ConnectionConfig & { id: string }> {
    return await invoke<ConnectionConfig & { id: string }>("get_connection", { id });
  }

  async saveConnection(config: ConnectionConfig): Promise<string> {
    const id = await invoke<string>("save_connection", { config });
    await this.listConnections();
    return id;
  }

  async deleteConnection(id: string): Promise<void> {
    await invoke<void>("delete_connection", { id });
    this.storage.removeConnection(id);
  }

  async testConnection(config: ConnectionConfig): Promise<ConnectionHealth> {
    return await invoke<ConnectionHealth>("test_connection", { config });
  }

  async listCollections(connId: string): Promise<CollectionMeta[]> {
    const collections = await invoke<CollectionMeta[]>("list_collections", { connId });
    this.storage.setCollections(collections);
    return collections;
  }

  async describeCollection(connId: string, collection: string): Promise<CollectionSchema> {
    return await invoke<CollectionSchema>("describe_collection", { connId, collection });
  }

  async getCollectionStats(connId: string, collection: string): Promise<CollectionStats> {
    return await invoke<CollectionStats>("get_collection_stats", { connId, collection });
  }

  async queryData(connId: string, collection: string, params: QueryParams): Promise<QueryResult> {
    const result = await invoke<QueryResult>("query_data", { connId, collection, query: params });
    this.storage.setCollectionData(collection, result.data, result.total);
    return result;
  }

  async saveRow(connId: string, collection: string, data: any): Promise<any> {
    const result = await invoke<any>("save_row", { connId, collection, data });
    this.storage.addToCollectionData(collection, result);
    return result;
  }

  async deleteRow(connId: string, collection: string, id: string): Promise<void> {
    await invoke<void>("delete_row", { connId, collection, id });
    this.storage.removeFromCollectionData(collection, id);
  }

  async createCollection(connId: string, name: string): Promise<void> {
    await invoke<void>("create_collection", { connId, name });
    await this.listCollections(connId);
  }

  async dropCollection(connId: string, name: string): Promise<void> {
    await invoke<void>("drop_collection", { connId, name });
    this.storage.clearCollectionData(name);
    await this.listCollections(connId);
  }

  async executeRaw(connId: string, sql: string): Promise<RawResult> {
    return await invoke<RawResult>("execute_raw", { connId, sql });
  }

  async getServerVersion(connId: string): Promise<string> {
    return await invoke<string>("get_server_version", { connId });
  }

  async getSystemStatus(): Promise<SystemMetrics> {
    const metrics = await invoke<SystemMetrics>("get_system_status");
    this.storage.setSystemMetrics(metrics);
    return metrics;
  }
}