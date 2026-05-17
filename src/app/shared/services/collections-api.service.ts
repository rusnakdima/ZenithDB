import { Injectable, inject, signal } from "@angular/core";
import { CacheService } from "@shared/services/cache.service";
import { TauriBridgeService } from "@providers/tauri-bridge.service";
import { CollectionMeta } from "@shared/models/connection.config";

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

  async listCollectionsWithRefresh(connectionId: string, dbName?: string): Promise<CollectionListResult> {
    this.invalidateCollections(connectionId);
    const result = await this.listCollections(connectionId, dbName, 0, 10);
    this.notifyRefresh(connectionId);
    return result;
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
    dbName: string | undefined,
    offset: number,
    limit: number
  ): Promise<CollectionListResult> {
    const result = await this.tauriBridge.invoke<{
      collections: CollectionMeta[];
      has_more: boolean;
      total_count: number;
    }>("collection_list", {
      connId: connectionId,
      dbName: dbName,
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

    return {
      collections: result.collections,
      hasMore: result.has_more,
      totalCount: result.total_count,
    };
  }

  private notifyRefresh(connectionId: string): void {
    this.refreshCallbacks.get(connectionId)?.forEach((cb) => cb());
  }
}