import { Injectable, inject } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { ConnectionStateService } from "./connection-state.service";
import {
  ConnectionSummary,
  ConnectionConfig,
  ConnectionHealth,
  CollectionMeta,
  CollectionSchema,
  CollectionStats,
  QueryParams,
  QueryResult,
  RawResult,
} from "../models/connection.config";

@Injectable({ providedIn: "root" })
export class DatabaseService {
  private connectionState = inject(ConnectionStateService);

  async listConnections(): Promise<ConnectionSummary[]> {
    return invoke("list_connections");
  }

  async saveConnection(config: ConnectionConfig): Promise<string> {
    return invoke("save_connection", { config });
  }

  async deleteConnection(id: string): Promise<void> {
    return invoke("delete_connection", { id });
  }

  async testConnection(config: ConnectionConfig): Promise<ConnectionHealth> {
    return invoke("test_connection", { config });
  }

  async listCollections(): Promise<CollectionMeta[]> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    return invoke("list_collections", { connId });
  }

  async describeCollection(collection: string): Promise<CollectionSchema> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    return invoke("describe_collection", { connId, collection });
  }

  async getCollectionStats(collection: string): Promise<CollectionStats> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    return invoke("get_collection_stats", { connId, collection });
  }

  async queryData(collection: string, params: QueryParams): Promise<QueryResult> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    return invoke("query_data", { connId, collection, query: params });
  }

  async saveRow(collection: string, data: any): Promise<any> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    return invoke("save_row", { connId, collection, data });
  }

  async deleteRow(collection: string, id: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    return invoke("delete_row", { connId, collection, id });
  }

  async createCollection(name: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    return invoke("create_collection", { connId, name });
  }

  async dropCollection(name: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    return invoke("drop_collection", { connId, name });
  }

  async executeRaw(sql: string): Promise<RawResult> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    return invoke("execute_raw", { connId, sql });
  }

  async getServerVersion(): Promise<string> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    return invoke("get_server_version", { connId });
  }
}
