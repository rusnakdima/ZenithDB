import { Injectable, inject } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { StorageService } from "@services/core/storage.service";
import { ToastService } from "@services/toast.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import {
  ConnectionSummary,
  ConnectionConfig,
  ConnectionConfigResult,
  TestConnectionConfig,
  ConnectionHealth,
  CollectionMeta,
  CollectionSchema,
  CollectionStats,
  QueryParams,
  QueryResult,
  RawResult,
  SystemMetrics,
  RowData,
  FilterExpression,
  DatabaseMeta,
} from "@shared/models/connection.config";

export interface CrudOptions {
  visibility?: "private" | "shared" | "public";
  connId?: string;
  collection?: string;
  id?: string;
  filter?: FilterExpression;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: "root" })
export class ApiProvider {
  private readonly MAX_RESPONSE_SIZE_MB = 10;
  private readonly MAX_RESPONSE_SIZE_BYTES = this.MAX_RESPONSE_SIZE_MB * 1024 * 1024;

  private storage = inject(StorageService);
  private abortController: AbortController | null = null;
  private toastService: ToastService | null = null;
  private errorHandler = inject(ErrorHandlerService);

  private getAbortSignal(): AbortSignal {
    this.abortController?.abort();
    this.abortController = new AbortController();
    return this.abortController.signal;
  }

  cancelPendingRequests(): void {
    this.abortController?.abort();
  }

  private getToastService(): ToastService {
    if (!this.toastService) {
      this.toastService = inject(ToastService);
    }
    return this.toastService;
  }

  private checkResponseSize(data: unknown): { truncated: boolean; message?: string } {
    try {
      const jsonStr = JSON.stringify(data);
      const sizeBytes = new Blob([jsonStr]).size;
      if (sizeBytes > this.MAX_RESPONSE_SIZE_BYTES) {
        return {
          truncated: true,
          message: `Response size (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB) exceeds ${this.MAX_RESPONSE_SIZE_MB}MB limit. Data may be truncated.`,
        };
      }
    } catch {
      return { truncated: false };
    }
    return { truncated: false };
  }

  async listConnections(): Promise<ConnectionSummary[]> {
    try {
      const connections = await invoke<ConnectionSummary[]>("list_connections", {
        options: { signal: this.getAbortSignal() },
      });
      this.storage.setConnections(connections);
      return connections;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return [];
      this.errorHandler.handleError(e, "listConnections");
      throw e;
    }
  }

  async getConnection(id: string): Promise<ConnectionConfigResult> {
    try {
      return await invoke<ConnectionConfigResult>("get_connection", {
        id,
        options: { signal: this.getAbortSignal() },
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") throw new Error("Operation cancelled");
      this.errorHandler.handleError(e, "getConnection");
      throw e;
    }
  }

  async saveConnection(config: ConnectionConfig): Promise<string> {
    try {
      const id = await invoke<string>("save_connection", {
        config,
        options: { signal: this.getAbortSignal() },
      });
      await this.listConnections();
      return id;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") throw new Error("Operation cancelled");
      this.errorHandler.handleError(e, "saveConnection");
      throw e;
    }
  }

  async deleteConnection(id: string): Promise<void> {
    try {
      await invoke<void>("delete_connection", { id, options: { signal: this.getAbortSignal() } });
      this.storage.removeConnection(id);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      this.errorHandler.handleError(e, "deleteConnection");
      throw e;
    }
  }

  async testConnection(config: TestConnectionConfig): Promise<ConnectionHealth> {
    try {
      return await invoke<ConnectionHealth>("test_connection", {
        config,
        options: { signal: this.getAbortSignal() },
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") throw new Error("Operation cancelled");
      this.errorHandler.handleError(e, "testConnection");
      throw e;
    }
  }

  async listCollections(connId: string): Promise<CollectionMeta[]> {
    try {
      const collections = await invoke<CollectionMeta[]>("list_collections", {
        connId,
        options: { signal: this.getAbortSignal() },
      });
      this.storage.setCollections(collections);
      return collections;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return [];
      this.errorHandler.handleError(e, "listCollections");
      throw e;
    }
  }

  async listDatabases(connId: string): Promise<DatabaseMeta[]> {
    try {
      return await invoke<DatabaseMeta[]>("list_databases", {
        connId,
        options: { signal: this.getAbortSignal() },
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return [];
      this.errorHandler.handleError(e, "listDatabases");
      throw e;
    }
  }

  async createDatabase(connId: string, name: string): Promise<void> {
    try {
      return await invoke<void>("create_database", {
        connId,
        name,
        options: { signal: this.getAbortSignal() },
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") throw new Error("Operation cancelled");
      this.errorHandler.handleError(e, "createDatabase");
      throw e;
    }
  }

  async describeCollection(connId: string, collection: string): Promise<CollectionSchema> {
    try {
      return await invoke<CollectionSchema>("describe_collection", {
        connId,
        collection,
        options: { signal: this.getAbortSignal() },
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") throw new Error("Operation cancelled");
      this.errorHandler.handleError(e, "describeCollection");
      throw e;
    }
  }

  async getCollectionStats(connId: string, collection: string): Promise<CollectionStats> {
    try {
      return await invoke<CollectionStats>("get_collection_stats", {
        connId,
        collection,
        options: { signal: this.getAbortSignal() },
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") throw new Error("Operation cancelled");
      this.errorHandler.handleError(e, "getCollectionStats");
      throw e;
    }
  }

  async queryData(connId: string, collection: string, params: QueryParams): Promise<QueryResult> {
    try {
      const result = await invoke<QueryResult>("query_data", {
        connId,
        collection,
        query: params,
        options: { signal: this.getAbortSignal() },
      });
      const sizeCheck = this.checkResponseSize(result.data);
      if (sizeCheck.truncated) {
        this.getToastService().warning(sizeCheck.message!);
        const maxItems = Math.floor(this.MAX_RESPONSE_SIZE_BYTES / 500);
        if (result.data.length > maxItems) {
          result.data = result.data.slice(0, maxItems);
        }
      }
      this.storage.setCollectionData(collection, result.data as RowData[], result.total);
      return result;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") throw new Error("Operation cancelled");
      this.errorHandler.handleError(e, "queryData");
      throw e;
    }
  }

  async saveRow(connId: string, collection: string, data: RowData): Promise<RowData | null> {
    try {
      const result = await invoke<RowData>("save_row", {
        connId,
        collection,
        data,
        options: { signal: this.getAbortSignal() },
      });
      this.storage.addToCollectionData(collection, result);
      return result;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return null;
      this.errorHandler.handleError(e, "saveRow");
      throw e;
    }
  }

  async deleteRow(connId: string, collection: string, id: string): Promise<void> {
    try {
      await invoke<void>("delete_row", {
        connId,
        collection,
        id,
        options: { signal: this.getAbortSignal() },
      });
      this.storage.removeFromCollectionData(collection, id);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      this.errorHandler.handleError(e, "deleteRow");
      throw e;
    }
  }

  async createCollection(connId: string, name: string): Promise<void> {
    try {
      await invoke<void>("create_collection", {
        connId,
        name,
        options: { signal: this.getAbortSignal() },
      });
      await this.listCollections(connId);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      this.errorHandler.handleError(e, "createCollection");
      throw e;
    }
  }

  async dropCollection(connId: string, name: string): Promise<void> {
    try {
      await invoke<void>("drop_collection", {
        connId,
        name,
        options: { signal: this.getAbortSignal() },
      });
      this.storage.clearCollectionData(name);
      await this.listCollections(connId);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      this.errorHandler.handleError(e, "dropCollection");
      throw e;
    }
  }

  async executeRaw(connId: string, sql: string): Promise<RawResult> {
    try {
      return await invoke<RawResult>("execute_raw", {
        connId,
        sql,
        options: { signal: this.getAbortSignal() },
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError")
        return { columns: [], rows: [], affected_rows: 0 } as RawResult;
      this.errorHandler.handleError(e, "executeRaw");
      throw e;
    }
  }

  async getServerVersion(connId: string): Promise<string> {
    try {
      return await invoke<string>("get_server_version", {
        connId,
        options: { signal: this.getAbortSignal() },
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "";
      this.errorHandler.handleError(e, "getServerVersion");
      throw e;
    }
  }

  async getSystemStatus(): Promise<SystemMetrics> {
    try {
      const metrics = await invoke<SystemMetrics>("get_system_status", {
        options: { signal: this.getAbortSignal() },
      });
      this.storage.setSystemMetrics(metrics);
      return metrics;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") throw new Error("Operation cancelled");
      this.errorHandler.handleError(e, "getSystemStatus");
      throw e;
    }
  }
}
