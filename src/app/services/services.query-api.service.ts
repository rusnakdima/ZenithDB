import { Injectable, inject } from "@angular/core";
import { CacheService } from "@shared/services/cache.service";
import { TauriBridgeService } from "@providers/tauri-bridge.service";
import { RequestCancellationService } from "@providers/request-cancellation.service";
import { QueryParams, QueryResult, RawResult, RowData } from "@entities/entities.connection.config";

@Injectable({ providedIn: "root" })
export class QueryApiService extends CacheService {
  private tauriBridge = inject(TauriBridgeService);
  private cancellation = inject(RequestCancellationService);
  private readonly page = "QueryApiService";

  async queryData(
    connId: string,
    collection: string,
    params: QueryParams
  ): Promise<QueryResult<RowData>> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "queryData", "query_execute", {
      connId,
      collection,
      params,
    });
    try {
      const result = await this.tauriBridge.invoke<QueryResult<RowData>>(
        "query_execute",
        { connectionId: connId, collection, params },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(this.page, "queryData", "query_execute", result, duration);
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(this.page, "queryData", "query_execute", String(err), duration);
      throw err;
    }
  }

  async saveRow(
    connId: string,
    collection: string,
    data: Record<string, unknown>
  ): Promise<RowData | null> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "saveRow", "query_save", {
      connId,
      collection,
      data,
    });
    try {
      const result = await this.tauriBridge.invoke<RowData>(
        "query_save",
        { connection_id: connId, collection, data },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(this.page, "saveRow", "query_save", result, duration);
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(this.page, "saveRow", "query_save", String(err), duration);
      throw err;
    }
  }

  async deleteRow(connId: string, collection: string, id: string): Promise<void> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "deleteRow", "query_delete", {
      connId,
      collection,
      id,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "query_delete",
        { connection_id: connId, collection, id },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "deleteRow",
        "query_delete",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(this.page, "deleteRow", "query_delete", String(err), duration);
      throw err;
    }
  }

  async executeRaw(connId: string, sql: string): Promise<RawResult> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "executeRaw", "query_raw", { connId, sql });
    try {
      const result = await this.tauriBridge.invoke<RawResult>(
        "query_raw",
        { connection_id: connId, sql },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(this.page, "executeRaw", "query_raw", result, duration);
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(this.page, "executeRaw", "query_raw", String(err), duration);
      throw err;
    }
  }

  async getServerVersion(connId: string): Promise<string> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "getServerVersion", "query_server_version", {
      connId,
    });
    try {
      const result = await this.tauriBridge.invoke<string>(
        "query_server_version",
        { connectionId: connId },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "getServerVersion",
        "query_server_version",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(
        this.page,
        "getServerVersion",
        "query_server_version",
        String(err),
        duration
      );
      throw err;
    }
  }

  async rebuildIndex(connId: string, collection: string, indexName: string): Promise<void> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "rebuildIndex", "rebuild_index", {
      connId,
      collection,
      indexName,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "rebuild_index",
        { connId: connId, collection, indexName },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "rebuildIndex",
        "rebuild_index",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(this.page, "rebuildIndex", "rebuild_index", String(err), duration);
      throw err;
    }
  }

  async createIndex(connId: string, collection: string, indexDef: unknown): Promise<void> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "createIndex", "create_index", {
      connId,
      collection,
      indexDef,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "create_index",
        { connId: connId, collection, index_definition: indexDef },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "createIndex",
        "create_index",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(this.page, "createIndex", "create_index", String(err), duration);
      throw err;
    }
  }

  async dropIndex(connId: string, collection: string, indexName: string): Promise<void> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "dropIndex", "drop_index", {
      connId,
      collection,
      indexName,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "drop_index",
        { connId: connId, collection, indexName },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "dropIndex",
        "drop_index",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(this.page, "dropIndex", "drop_index", String(err), duration);
      throw err;
    }
  }

  async insertDocument(connId: string, collection: string, data: RowData): Promise<RowData | null> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "insertDocument", "insert_document", {
      connId,
      collection,
      data,
    });
    try {
      const result = await this.tauriBridge.invoke<RowData>(
        "insert_document",
        { connId, collection, data },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(this.page, "insertDocument", "insert_document", result, duration);
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(this.page, "insertDocument", "insert_document", String(err), duration);
      throw err;
    }
  }

  async updateDocument(
    connId: string,
    collection: string,
    id: string,
    data: RowData
  ): Promise<RowData | null> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "updateDocument", "update_document", {
      connId,
      collection,
      id,
      data,
    });
    try {
      const result = await this.tauriBridge.invoke<RowData>(
        "update_document",
        { connId, collection, id, data },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(this.page, "updateDocument", "update_document", result, duration);
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(this.page, "updateDocument", "update_document", String(err), duration);
      throw err;
    }
  }

  async deleteDocument(connId: string, collection: string, id: string): Promise<void> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "deleteDocument", "delete_document", {
      connId,
      collection,
      id,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "delete_document",
        { connId, collection, id },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "deleteDocument",
        "delete_document",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(this.page, "deleteDocument", "delete_document", String(err), duration);
      throw err;
    }
  }

  async softDeleteDocument(connId: string, collection: string, id: string): Promise<void> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "softDeleteDocument", "soft_delete_document", {
      connId,
      collection,
      id,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "soft_delete_document",
        { connId, collection, id },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "softDeleteDocument",
        "soft_delete_document",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(
        this.page,
        "softDeleteDocument",
        "soft_delete_document",
        String(err),
        duration
      );
      throw err;
    }
  }
}
