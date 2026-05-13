import { Injectable, inject, signal } from "@angular/core";
import { CacheService } from "@shared/services/cache.service";
import { TauriBridgeService } from "@providers/tauri-bridge.service";
import { CollectionMeta } from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class CollectionsApiService extends CacheService {
  private collectionsSignal = signal<Map<string, CollectionMeta[]>>(new Map());
  private refreshCallbacks = new Map<string, Set<() => void>>();
  private tauriBridge = inject(TauriBridgeService);

  getCollections(connectionId: string): CollectionMeta[] {
    return this.collectionsSignal().get(connectionId) ?? [];
  }

  async listCollections(connectionId: string, dbName?: string): Promise<CollectionMeta[]> {
    const cached = this.getCollections(connectionId);
    if (cached.length > 0) return cached;
    return this.fetchCollections(connectionId);
  }

  async listCollectionsWithRefresh(connectionId: string): Promise<CollectionMeta[]> {
    const result = await this.fetchCollections(connectionId);
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

  private async fetchCollections(connectionId: string): Promise<CollectionMeta[]> {
    const cacheKey = `collections:${connectionId}`;
    return this.getOrFetch(cacheKey, () =>
      this.tauriBridge
        .invoke<CollectionMeta[]>("list_collections", { connId: connectionId })
        .then((result) => {
          this.collectionsSignal.update((map) => {
            const newMap = new Map(map);
            newMap.set(connectionId, result);
            return newMap;
          });
          return result;
        })
    );
  }

  private notifyRefresh(connectionId: string): void {
    this.refreshCallbacks.get(connectionId)?.forEach((cb) => cb());
  }
}
