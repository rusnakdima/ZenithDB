import { Injectable, inject, signal } from "@angular/core";
import { CacheService } from "@shared/services/cache.service";
import { TauriBridgeService } from "@providers/tauri-bridge.service";
import { RequestCancellationService } from "@providers/request-cancellation.service";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import {
  CollectionMeta,
  CollectionSchema,
  CollectionStats,
} from "@shared/models/connection.config";

export interface CollectionListResult {
  collections: CollectionMeta[];
  hasMore: boolean;
  totalCount: number;
}

@Injectable({ providedIn: "root" })
export class CollectionsApiService extends CacheService {
  private collectionsSignal = signal<Map<string, CollectionMeta[]>>(new Map());
  private refreshCallbacks = new Map<string, Set<() => void>>();
  private inFlightCollections = new Map<string, Promise<CollectionListResult>>();
  private tauriBridge = inject(TauriBridgeService);
  private cancellation = inject(RequestCancellationService);
  private readonly page = "CollectionsApiService";

  getCollections(connectionId: string): CollectionMeta[] {
    return this.collectionsSignal().get(connectionId) ?? [];
  }

  getCollectionsSignal(connectionId: string) {
    return this.collectionsSignal;
  }

  async listCollections(
    connectionId: string,
    dbName?: string,
    offset = 0,
    limit = 10
  ): Promise<CollectionListResult> {
    if (offset === 0) {
      const cacheKey = `${connectionId}:${dbName || "all"}`;
      const existing = this.inFlightCollections.get(cacheKey);
      if (existing) {
        return existing.catch(() => ({ collections: [], hasMore: false, totalCount: 0 }));
      }
      const promise = this.fetchCollections(connectionId, dbName, offset, limit).finally(() => {
        this.inFlightCollections.delete(cacheKey);
      });
      this.inFlightCollections.set(cacheKey, promise);
      return promise;
    }
    return this.fetchCollections(connectionId, dbName, offset, limit);
  }

  async listCollectionsWithRefresh(
    connectionId: string,
    dbName?: string
  ): Promise<CollectionListResult> {
    this.logger?.logApiCall(this.page, "listCollectionsWithRefresh", "collection_list", {
      connectionId,
      dbName,
    });
    const startTime = performance.now();
    try {
      this.invalidateCollections(connectionId);
      const result = await this.listCollections(connectionId, dbName, 0, 10);
      this.notifyRefresh(connectionId);
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "listCollectionsWithRefresh",
        "collection_list",
        { count: result.collections.length },
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(
        this.page,
        "listCollectionsWithRefresh",
        "collection_list",
        String(err),
        duration
      );
      throw err;
    }
  }

  onCollectionsRefreshed(connectionId: string, callback: () => void): () => void {
    this.refreshCallbacks.get(connectionId)?.add(callback) ||
      this.refreshCallbacks.set(connectionId, new Set([callback]));
    return () => this.refreshCallbacks.get(connectionId)?.delete(callback);
  }

  invalidateCollections(connectionId?: string): void {
    if (connectionId) {
      this.collectionsSignal.update((map) => {
        const newMap = new Map(map);
        newMap.delete(connectionId);
        return newMap;
      });
    } else {
      this.collectionsSignal.set(new Map());
    }
  }

  private async fetchCollections(
    connectionId: string,
    db_name: string | undefined,
    offset: number,
    limit: number
  ): Promise<CollectionListResult> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "fetchCollections", "collection_fetch", {
      connectionId,
      db_name,
      offset,
      limit,
    });
    const result = await this.tauriBridge.invoke<{
      collections: CollectionMeta[];
      has_more: boolean;
      total_count: number;
    }>("collection_list", {
      connId: connectionId,
      db_name,
      offset,
      limit,
    });

    if (offset === 0) {
      this.collectionsSignal.update((map) => {
        const newMap = new Map(map);
        newMap.set(connectionId, result.collections);
        return newMap;
      });
    } else {
      this.collectionsSignal.update((map) => {
        const newMap = new Map(map);
        const existing = newMap.get(connectionId) ?? [];
        newMap.set(connectionId, [...existing, ...result.collections]);
        return newMap;
      });
    }

    this.logger?.logDataReceive(
      this.page,
      "fetchCollections",
      "collection_fetch",
      { connectionId, count: result.collections.length },
      performance.now() - startTime
    );

    return {
      collections: result.collections,
      hasMore: result.has_more,
      totalCount: result.total_count,
    };
  }

  private notifyRefresh(connectionId: string): void {
    this.refreshCallbacks.get(connectionId)?.forEach((cb) => cb());
  }

  async describeCollection(connId: string, collection: string): Promise<CollectionSchema> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "describeCollection", "collection_describe", {
      connId,
      collection,
    });
    try {
      const result = await this.tauriBridge.invoke<CollectionSchema>(
        "collection_describe",
        { connection_id: connId, name: collection },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "describeCollection",
        "collection_describe",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(
        this.page,
        "describeCollection",
        "collection_describe",
        String(err),
        duration
      );
      throw err;
    }
  }

  async getCollectionStats(connId: string, collection: string): Promise<CollectionStats> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "getCollectionStats", "collection_stats", {
      connId,
      collection,
    });
    try {
      const result = await this.tauriBridge.invoke<CollectionStats>(
        "collection_stats",
        { connection_id: connId, name: collection },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "getCollectionStats",
        "collection_stats",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(
        this.page,
        "getCollectionStats",
        "collection_stats",
        String(err),
        duration
      );
      throw err;
    }
  }

  async createCollection(connId: string, name: string): Promise<void> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "createCollection", "collection_create", {
      connId,
      name,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "collection_create",
        { connection_id: connId, name },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "createCollection",
        "collection_create",
        { success: true },
        duration
      );
      this.invalidateCollections(connId);
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(
        this.page,
        "createCollection",
        "collection_create",
        String(err),
        duration
      );
      throw err;
    }
  }

  async dropCollection(connId: string, name: string): Promise<void> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "dropCollection", "collection_drop", {
      connId,
      name,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "collection_drop",
        { connection_id: connId, name },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "dropCollection",
        "collection_drop",
        { success: true },
        duration
      );
      this.invalidateCollections(connId);
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(this.page, "dropCollection", "collection_drop", String(err), duration);
      throw err;
    }
  }

  async renameCollection(connId: string, oldName: string, newName: string): Promise<void> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "renameCollection", "collection_rename", {
      connId,
      oldName,
      newName,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "collection_rename",
        { connection_id: connId, old_name: oldName, new_name: newName },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "renameCollection",
        "collection_rename",
        { success: true },
        duration
      );
      this.invalidateCollections(connId);
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(
        this.page,
        "renameCollection",
        "collection_rename",
        String(err),
        duration
      );
      throw err;
    }
  }

  async createDatabase(connId: string, name: string): Promise<void> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "createDatabase", "create_database", {
      connId,
      name,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "create_database",
        { connection_id: connId, name },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "createDatabase",
        "create_database",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(this.page, "createDatabase", "create_database", String(err), duration);
      throw err;
    }
  }

  async deleteDatabase(connId: string, name: string): Promise<void> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "deleteDatabase", "delete_database", {
      connId,
      name,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "delete_database",
        { connection_id: connId, name },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "deleteDatabase",
        "delete_database",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(this.page, "deleteDatabase", "delete_database", String(err), duration);
      throw err;
    }
  }

  async renameDatabase(connId: string, oldName: string, newName: string): Promise<void> {
    const startTime = performance.now();
    this.logger?.logApiCall(this.page, "renameDatabase", "rename_database", {
      connId,
      oldName,
      newName,
    });
    try {
      await this.tauriBridge.invoke<void>(
        "rename_database",
        { connection_id: connId, old_name: oldName, new_name: newName },
        { signal: this.cancellation.createAbortSignal(), suppressError: true }
      );
      const duration = performance.now() - startTime;
      this.logger?.logDataReceive(
        this.page,
        "renameDatabase",
        "rename_database",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.logger?.logError(this.page, "renameDatabase", "rename_database", String(err), duration);
      throw err;
    }
  }
}
