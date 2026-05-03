import { Injectable, inject } from "@angular/core";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { LoadingService } from "@shared/services/loading.service";
import { ApiProvider } from "@providers/api.provider";
import { StorageService } from "@services/core/storage.service";
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
  SystemMetrics,
} from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class DatabaseService {
  private connectionState = inject(ConnectionStateService);
  private loadingService = inject(LoadingService);
  private api = inject(ApiProvider);
  private storage = inject(StorageService);

  async listConnections(): Promise<ConnectionSummary[]> {
    this.loadingService.show("Loading connections...");
    try {
      return await this.api.listConnections();
    } finally {
      this.loadingService.hide();
    }
  }

  async getConnection(id: string): Promise<ConnectionConfig & { id: string }> {
    this.loadingService.show("Loading connection...");
    try {
      return await this.api.getConnection(id);
    } finally {
      this.loadingService.hide();
    }
  }

  async saveConnection(config: ConnectionConfig): Promise<string> {
    this.loadingService.show("Saving connection...");
    try {
      return await this.api.saveConnection(config);
    } finally {
      this.loadingService.hide();
    }
  }

  async deleteConnection(id: string): Promise<void> {
    this.loadingService.show("Deleting connection...");
    try {
      return await this.api.deleteConnection(id);
    } finally {
      this.loadingService.hide();
    }
  }

  async testConnection(config: ConnectionConfig): Promise<ConnectionHealth> {
    this.loadingService.show("Testing connection...");
    try {
      return await this.api.testConnection(config);
    } finally {
      this.loadingService.hide();
    }
  }

  async listCollections(): Promise<CollectionMeta[]> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) throw new Error("No active connection");
    this.loadingService.show("Loading collections...");
    try {
      return await this.api.listCollections(connId);
    } finally {
      this.loadingService.hide();
    }
  }

  async describeCollection(collection: string): Promise<CollectionSchema> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) throw new Error("No active connection");
    this.loadingService.show(`Describing ${collection}...`);
    try {
      return await this.api.describeCollection(connId, collection);
    } finally {
      this.loadingService.hide();
    }
  }

  async getCollectionStats(collection: string): Promise<CollectionStats> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) throw new Error("No active connection");
    this.loadingService.show(`Loading stats for ${collection}...`);
    try {
      return await this.api.getCollectionStats(connId, collection);
    } finally {
      this.loadingService.hide();
    }
  }

  async queryData(collection: string, params: QueryParams): Promise<QueryResult> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) throw new Error("No active connection");
    this.loadingService.show("Executing query...");
    try {
      return await this.api.queryData(connId, collection, params);
    } finally {
      this.loadingService.hide();
    }
  }

  async saveRow(collection: string, data: any): Promise<any> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) throw new Error("No active connection");
    this.loadingService.show("Saving row...");
    try {
      return await this.api.saveRow(connId, collection, data);
    } finally {
      this.loadingService.hide();
    }
  }

  async deleteRow(collection: string, id: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) throw new Error("No active connection");
    this.loadingService.show("Deleting row...");
    try {
      return await this.api.deleteRow(connId, collection, id);
    } finally {
      this.loadingService.hide();
    }
  }

  async createCollection(name: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) throw new Error("No active connection");
    this.loadingService.show(`Creating collection ${name}...`);
    try {
      return await this.api.createCollection(connId, name);
    } finally {
      this.loadingService.hide();
    }
  }

  async dropCollection(name: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) throw new Error("No active connection");
    this.loadingService.show(`Dropping collection ${name}...`);
    try {
      return await this.api.dropCollection(connId, name);
    } finally {
      this.loadingService.hide();
    }
  }

  async executeRaw(sql: string): Promise<RawResult> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) throw new Error("No active connection");
    this.loadingService.show("Executing SQL...");
    try {
      return await this.api.executeRaw(connId, sql);
    } finally {
      this.loadingService.hide();
    }
  }

  async getServerVersion(): Promise<string> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) throw new Error("No active connection");
    this.loadingService.show("Fetching server version...");
    try {
      return await this.api.getServerVersion(connId);
    } finally {
      this.loadingService.hide();
    }
  }

  async getSystemStatus(): Promise<SystemMetrics> {
    return await this.api.getSystemStatus();
  }
}