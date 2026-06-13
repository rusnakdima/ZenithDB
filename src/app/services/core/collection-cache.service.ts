import { Injectable, inject, signal, computed } from "@angular/core";
import { CollectionMeta } from "@shared/models/connection.config";
import { DatabaseService } from "@shared/services/database.service";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { CACHE_CONSTANTS } from "@shared/utils/constants";
import { evictLRUInPlace } from "@shared/utils/cache.utils";

interface CollectionsCacheEntry {
  collections: CollectionMeta[];
  lastAccessed: number;
}

@Injectable({ providedIn: "root" })
export class CollectionCacheService {
  private db = inject(DatabaseService);
  private dataflowLogger = inject(DataflowLoggerService);
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
    this.dataflowLogger.logApiCall(this.page, "refreshCollections", "collection_list", {
      connectionId,
      dbName,
    });
    const startTime = performance.now();
    try {
      this.invalidateCollections(connectionId);
      const collections = await this.db.listCollections(connectionId, dbName);
      this.updateCollections(connectionId, collections);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "refreshCollections",
        "collection_list",
        { count: collections.length },
        duration
      );
      return collections;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "refreshCollections",
        "collection_list",
        String(err),
        duration
      );
      throw err;
    }
  }

  async createCollection(name: string): Promise<void> {
    this.dataflowLogger.logApiCall(this.page, "createCollection", "create_collection", { name });
    const startTime = performance.now();
    try {
      await this.db.createCollection(name);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "createCollection",
        "create_collection",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "createCollection",
        "create_collection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async renameCollection(connId: string, oldName: string, newName: string): Promise<void> {
    this.dataflowLogger.logApiCall(this.page, "renameCollection", "rename_collection", {
      connId,
      oldName,
      newName,
    });
    const startTime = performance.now();
    try {
      await this.db.renameCollection(connId, oldName, newName);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "renameCollection",
        "rename_collection",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "renameCollection",
        "rename_collection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async dropCollection(name: string): Promise<void> {
    this.dataflowLogger.logApiCall(this.page, "dropCollection", "drop_collection", { name });
    const startTime = performance.now();
    try {
      await this.db.dropCollection(name);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "dropCollection",
        "drop_collection",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "dropCollection",
        "drop_collection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async getCollectionStats(collection: string): Promise<import("@shared/models/connection.config").CollectionStats> {
    this.dataflowLogger.logApiCall(this.page, "getCollectionStats", "get_collection_stats", {
      collection,
    });
    const startTime = performance.now();
    try {
      const result = await this.db.getCollectionStats(collection);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "getCollectionStats",
        "get_collection_stats",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "getCollectionStats",
        "get_collection_stats",
        String(err),
        duration
      );
      throw err;
    }
  }
}
