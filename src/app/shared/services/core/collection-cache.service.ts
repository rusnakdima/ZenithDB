import { Injectable, inject, signal, computed } from "@angular/core";
import { CollectionMeta } from "@entities/entities.connection.config";
import { DatabaseService } from "@services/services.database.service";
import { CACHE_CONSTANTS } from "@shared/utils/constants";
import { evictLRUInPlace } from "@shared/utils/cache.utils";
interface CollectionsCacheEntry {
  collections: CollectionMeta[];
  lastAccessed: number;
}
@Injectable({ providedIn: "root" })
export class CollectionCacheService {
  private db = inject(DatabaseService);
  private readonly page = "CollectionCacheService";
  private readonly MAX_COLLECTIONS_CACHE = CACHE_CONSTANTS.MAX_COLLECTIONS_CACHE;
  private collectionsSignal = signal<Map<string, CollectionsCacheEntry>>(new Map());
  readonly collections = computed(() => {
    const map = this.collectionsSignal();
    const result: CollectionMeta[] = [];
    for (const entry of map.values()) {
      result.push(...entry.collections);
    }
    return result;
  });
  getCollections(connectionId?: string): CollectionMeta[] {
    if (connectionId) {
      return this.collectionsSignal().get(connectionId)?.collections ?? [];
    }
    return this.collections();
  }
  getCollection(connectionId: string, name: string): CollectionMeta | undefined {
    const entry = this.collectionsSignal().get(connectionId);
    const collections = entry?.collections ?? [];
    return collections.find((c) => c.name === name);
  }
  updateCollections(connectionId: string, collections: CollectionMeta[]): void {
    this.collectionsSignal.update((map) => {
      const newMap = new Map(map);
      newMap.set(connectionId, { collections, lastAccessed: Date.now() });
      return newMap;
    });
    this.evictLRUCollections();
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
  private evictLRUCollections(): void {
    evictLRUInPlace(this.collectionsSignal(), this.MAX_COLLECTIONS_CACHE);
  }
  async ensureCollectionsLoaded(connectionId: string, dbName?: string): Promise<CollectionMeta[]> {
    const cached = this.collectionsSignal().get(connectionId);
    if (cached && cached.collections.length > 0) return cached.collections;
    const collections = await this.db.listCollections(connectionId, dbName);
    this.updateCollections(connectionId, collections);
    return collections;
  }
  async refreshCollections(connectionId: string, dbName?: string): Promise<CollectionMeta[]> {
    this.invalidateCollections(connectionId);
    const collections = await this.db.listCollections(connectionId, dbName);
    this.updateCollections(connectionId, collections);
    return collections;
  }
  async createCollection(name: string): Promise<void> {
    await this.db.createCollection(name);
  }
  async renameCollection(connId: string, oldName: string, newName: string): Promise<void> {
    await this.db.renameCollection(connId, oldName, newName);
  }
  async dropCollection(name: string): Promise<void> {
    await this.db.dropCollection(name);
  }
  async getCollectionStats(
    collection: string
  ): Promise<import("@entities/entities.connection.config").CollectionStats> {
    return this.db.getCollectionStats(collection);
  }
}
