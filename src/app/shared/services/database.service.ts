import { Injectable, inject } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { ConnectionStateService } from "./connection-state.service";
import { LoadingService } from "./loading.service";
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
  private loadingService = inject(LoadingService);

  async listConnections(): Promise<ConnectionSummary[]> {
    this.loadingService.show("Loading connections...");
    try {
      return await invoke("list_connections");
    } finally {
      this.loadingService.hide();
    }
  }

  async saveConnection(config: ConnectionConfig): Promise<string> {
    this.loadingService.show("Saving connection...");
    try {
      return await invoke("save_connection", { config });
    } finally {
      this.loadingService.hide();
    }
  }

  async deleteConnection(id: string): Promise<void> {
    this.loadingService.show("Deleting connection...");
    try {
      return await invoke("delete_connection", { id });
    } finally {
      this.loadingService.hide();
    }
  }

  async testConnection(config: ConnectionConfig): Promise<ConnectionHealth> {
    this.loadingService.show("Testing connection...");
    try {
      return await invoke("test_connection", { config });
    } finally {
      this.loadingService.hide();
    }
  }

  async listCollections(): Promise<CollectionMeta[]> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    this.loadingService.show("Loading collections...");
    try {
      return await invoke("list_collections", { connId });
    } finally {
      this.loadingService.hide();
    }
  }

  async describeCollection(collection: string): Promise<CollectionSchema> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    this.loadingService.show(`Describing ${collection}...`);
    try {
      return await invoke("describe_collection", { connId, collection });
    } finally {
      this.loadingService.hide();
    }
  }

  async getCollectionStats(collection: string): Promise<CollectionStats> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    this.loadingService.show(`Loading stats for ${collection}...`);
    try {
      return await invoke("get_collection_stats", { connId, collection });
    } finally {
      this.loadingService.hide();
    }
  }

  async queryData(collection: string, params: QueryParams): Promise<QueryResult> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    this.loadingService.show("Executing query...");
    try {
      return await invoke("query_data", { connId, collection, query: params });
    } finally {
      this.loadingService.hide();
    }
  }

  async saveRow(collection: string, data: any): Promise<any> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    this.loadingService.show("Saving row...");
    try {
      return await invoke("save_row", { connId, collection, data });
    } finally {
      this.loadingService.hide();
    }
  }

  async deleteRow(collection: string, id: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    this.loadingService.show("Deleting row...");
    try {
      return await invoke("delete_row", { connId, collection, id });
    } finally {
      this.loadingService.hide();
    }
  }

  async createCollection(name: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    this.loadingService.show(`Creating collection ${name}...`);
    try {
      return await invoke("create_collection", { connId, name });
    } finally {
      this.loadingService.hide();
    }
  }

  async dropCollection(name: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    this.loadingService.show(`Dropping collection ${name}...`);
    try {
      return await invoke("drop_collection", { connId, name });
    } finally {
      this.loadingService.hide();
    }
  }

  async executeRaw(sql: string): Promise<RawResult> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    this.loadingService.show("Executing SQL...");
    try {
      return await invoke("execute_raw", { connId, sql });
    } finally {
      this.loadingService.hide();
    }
  }

  async getServerVersion(): Promise<string> {
    const connId = this.connectionState.activeConnectionId;
    if (!connId) throw new Error("No active connection");
    this.loadingService.show("Fetching server version...");
    try {
      return await invoke("get_server_version", { connId });
    } finally {
      this.loadingService.hide();
    }
  }
}
