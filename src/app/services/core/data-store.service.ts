import { Injectable, inject, signal, computed, Injector } from "@angular/core";
import {
  ConnectionSummary,
  ConnectionHealth,
  CollectionMeta,
  SystemMetrics,
  ColumnInfo,
  QueryParams,
  QueryResult,
  RowData,
  DatabaseMetadata,
  CollectionStats,
  TestConnectionConfig,
  CollectionSchema,
} from "@shared/models/connection.config";
import { DatabaseService } from "@shared/services/database.service";
import {
  DecentralizationApiService,
  DatabaseListResult,
} from "@shared/services/decentralization-api.service";
import {
  CollectionsApiService,
  CollectionListResult,
} from "@shared/services/collections-api.service";
import { findById } from "@shared/utils/array.utils";

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  lastAccessed: number;
  ttl: number;
}

export interface QueryCacheEntry {
  data: RowData[];
  total: number;
  queryParams: QueryParams;
}

interface HealthCacheEntry {
  health: ConnectionHealth;
  timestamp: number;
}

interface ColumnsCacheEntry {
  columns: ColumnInfo[];
  timestamp: number;
  lastAccessed: number;
}

@Injectable({ providedIn: "root" })
export class DataStoreService {
  private injector = inject(Injector);
  private decentralizationApi = inject(DecentralizationApiService);
  private collectionsApi = inject(CollectionsApiService);

  private get db(): DatabaseService {
    return this.injector.get(DatabaseService);
  }

  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000;
  private readonly HEALTH_TTL_MS = 30 * 1000;
  private readonly MAX_CONNECTIONS_CACHE = 100;
  private readonly MAX_COLLECTIONS_CACHE = 200;
  private readonly MAX_COLUMNS_CACHE_SIZE = 100;
  private readonly MAX_ENTRIES_PER_COLLECTION = 50;

  private connectionsSignal = signal<ConnectionSummary[]>([]);
  private collectionsSignal = signal<Map<string, CollectionMeta[]>>(new Map());
  private databasesSignal = signal<Map<string, DatabaseMetadata[]>>(new Map());
  private systemMetricsSignal = signal<SystemMetrics | null>(null);
  private healthCacheSignal = signal<Map<string, HealthCacheEntry>>(new Map());
  private columnsCacheSignal = signal<Map<string, ColumnsCacheEntry>>(new Map());
  private collectionDataCacheSignal = signal<Map<string, QueryCacheEntry>>(new Map());

  private genericCache = signal<Map<string, CacheEntry<unknown>>>(new Map());
  private inFlightRequests = new Map<string, Promise<unknown>>();

  readonly connections = this.connectionsSignal.asReadonly();
  readonly collections = computed(() => {
    const map = this.collectionsSignal();
    const result: CollectionMeta[] = [];
    for (const collections of map.values()) {
      result.push(...collections);
    }
    return result;
  });
  readonly databases = computed(() => {
    const map = this.databasesSignal();
    const result: DatabaseMetadata[] = [];
    for (const dbs of map.values()) {
      result.push(...dbs);
    }
    return result;
  });
  readonly systemMetrics = this.systemMetricsSignal.asReadonly();
  readonly healthStatus = computed(() => {
    const map = this.healthCacheSignal();
    const result: Record<string, ConnectionHealth> = {};
    for (const [id, entry] of map.entries()) {
      if (Date.now() - entry.timestamp <= this.HEALTH_TTL_MS) {
        result[id] = entry.health;
      }
    }
    return result;
  });

  getConnections(): ConnectionSummary[] {
    return this.connectionsSignal();
  }

  getConnection(id: string): ConnectionSummary | undefined {
    return findById(this.connectionsSignal(), id);
  }

  updateConnections(connections: ConnectionSummary[]): void {
    this.connectionsSignal.set(connections);
  }

  removeConnection(id: string): void {
    this.connectionsSignal.update((conns) => conns.filter((c) => c.id !== id));
  }

  updateConnection(id: string, updates: Partial<ConnectionSummary>): void {
    this.connectionsSignal.update((conns) =>
      conns.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }

  getDatabases(connectionId: string): DatabaseMetadata[] {
    return this.databasesSignal().get(connectionId) ?? [];
  }

  updateDatabases(connectionId: string, databases: DatabaseMetadata[]): void {
    this.databasesSignal.update((map) => {
      const newMap = new Map(map);
      newMap.set(connectionId, databases);
      return newMap;
    });
  }

  getCollections(connectionId?: string): CollectionMeta[] {
    if (connectionId) {
      return this.collectionsSignal().get(connectionId) ?? [];
    }
    return this.collections();
  }

  getCollection(connectionId: string, name: string): CollectionMeta | undefined {
    const collections = this.collectionsSignal().get(connectionId) ?? [];
    return collections.find((c) => c.name === name);
  }

  updateCollections(connectionId: string, collections: CollectionMeta[]): void {
    this.collectionsSignal.update((map) => {
      const newMap = new Map(map);
      newMap.set(connectionId, collections);
      return newMap;
    });
    this.evictLRUCollections(connectionId);
  }

  getHealth(connectionId: string): ConnectionHealth | null {
    const cached = this.healthCacheSignal().get(connectionId);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.HEALTH_TTL_MS) {
      this.invalidate(`health:${connectionId}`);
      return null;
    }
    return cached.health;
  }

  updateHealth(connectionId: string, health: ConnectionHealth): void {
    this.healthCacheSignal.update((map) => {
      const newMap = new Map(map);
      newMap.set(connectionId, { health, timestamp: Date.now() });
      return newMap;
    });
  }

  async checkHealth(connectionId: string): Promise<ConnectionHealth> {
    const cached = this.getHealth(connectionId);
    if (cached) return cached;

    const health = await this.db.testConnectionById(connectionId);
    const result = health ?? {
      healthy: false,
      provider: "unknown",
      latency_ms: 0,
      message: "Connection test failed",
    };

    this.updateHealth(connectionId, result);
    return result;
  }

  getCached<T>(key: string): T | null {
    const entry = this.genericCache().get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.invalidate(key);
      return null;
    }
    this.genericCache.update((map) => {
      const newMap = new Map(map);
      const existing = newMap.get(key) as CacheEntry<T>;
      newMap.set(key, { ...existing, lastAccessed: Date.now() });
      return newMap;
    });
    return entry.data;
  }

  setCached<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL_MS): void {
    this.genericCache.update((map) => {
      const newMap = new Map(map);
      newMap.set(key, {
        data,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        ttl,
      });
      return newMap;
    });
  }

  invalidate(key: string): void {
    this.genericCache.update((map) => {
      const newMap = new Map(map);
      newMap.delete(key);
      return newMap;
    });
    this.healthCacheSignal.update((map) => {
      const newMap = new Map(map);
      newMap.delete(key.replace("health:", ""));
      return newMap;
    });
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    this.genericCache.update((map) => {
      const newMap = new Map(map);
      for (const key of newMap.keys()) {
        if (regex.test(key)) {
          newMap.delete(key);
        }
      }
      return newMap;
    });
  }

  invalidateAll(): void {
    this.genericCache.set(new Map());
    this.healthCacheSignal.set(new Map());
    this.columnsCacheSignal.set(new Map());
    this.collectionDataCacheSignal.set(new Map());
    this.collectionsSignal.set(new Map());
    this.databasesSignal.set(new Map());
    this.connectionsSignal.set([]);
    this.systemMetricsSignal.set(null);
  }

  private evictLRUCollections(connectionId: string): void {
    const cache = this.collectionsSignal();
    if (cache.size > this.MAX_COLLECTIONS_CACHE) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].length - b[1].length);
      const toRemove = entries.slice(0, cache.size - this.MAX_COLLECTIONS_CACHE);
      this.collectionsSignal.update((map) => {
        const newMap = new Map(map);
        for (const [key] of toRemove) {
          newMap.delete(key);
        }
        return newMap;
      });
    }
  }

  private evictLRUColumns(): void {
    const cache = this.columnsCacheSignal();
    if (cache.size >= this.MAX_COLUMNS_CACHE_SIZE) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      const toRemove = entries.slice(0, cache.size - this.MAX_COLUMNS_CACHE_SIZE + 1);
      this.columnsCacheSignal.update((map) => {
        const newMap = new Map(map);
        for (const [key] of toRemove) {
          newMap.delete(key);
        }
        return newMap;
      });
    }
  }

  getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL_MS
  ): Promise<T> {
    const cached = this.getCached<T>(key);
    if (cached !== null) {
      return Promise.resolve(cached);
    }

    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key) as Promise<T>;
    }

    const requestPromise = (async () => {
      try {
        const result = await fetchFn();
        this.setCached(key, result, ttl);
        return result;
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, requestPromise as unknown as Promise<unknown>);
    return requestPromise;
  }

  async queryData(
    collection: string,
    params: QueryParams = {},
    forceRefresh = false
  ): Promise<QueryResult<RowData>> {
    const cacheKey = `query:${collection}_${JSON.stringify(params)}`;

    if (!forceRefresh) {
      const cached = this.collectionDataCacheSignal().get(cacheKey);
      if (cached) {
        return {
          data: cached.data,
          total: cached.total,
          has_more: false,
        };
      }
    }

    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey) as Promise<QueryResult<RowData>>;
    }

    const requestPromise = (async () => {
      try {
        const result = await this.db.queryData(collection, params);
        this.collectionDataCacheSignal.update((map) => {
          const newMap = new Map(map);
          newMap.set(cacheKey, {
            data: result.data,
            total: result.total,
            queryParams: params,
          });
          return newMap;
        });
        return result as QueryResult<RowData>;
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, requestPromise as unknown as Promise<unknown>);
    return requestPromise;
  }

  async loadColumns(collection: string, forceRefresh = false): Promise<ColumnInfo[]> {
    const cacheKey = `${collection}_schema`;
    const cached = this.columnsCacheSignal().get(cacheKey);

    if (!forceRefresh && cached) {
      if (Date.now() - cached.timestamp < this.DEFAULT_TTL_MS) {
        this.columnsCacheSignal.update((map) => {
          const newMap = new Map(map);
          newMap.set(cacheKey, { ...cached, lastAccessed: Date.now() });
          return newMap;
        });
        return cached.columns;
      }
    }

    this.evictLRUColumns();

    const schema = await this.db.describeCollection(collection);
    this.columnsCacheSignal.update((map) => {
      const newMap = new Map(map);
      newMap.set(cacheKey, {
        columns: schema.columns,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
      });
      return newMap;
    });
    return schema.columns;
  }

  invalidateCollectionCache(collection: string): void {
    this.collectionDataCacheSignal.update((map) => {
      const newMap = new Map(map);
      for (const key of newMap.keys()) {
        if (key.startsWith(`query:${collection}_`)) {
          newMap.delete(key);
        }
      }
      return newMap;
    });
    this.invalidateColumnsCache(collection);
  }

  invalidateColumnsCache(collection?: string): void {
    if (collection) {
      this.columnsCacheSignal.update((map) => {
        const newMap = new Map(map);
        newMap.delete(`${collection}_schema`);
        return newMap;
      });
    } else {
      this.columnsCacheSignal.set(new Map());
    }
  }

  invalidateConnections(): void {
    this.connectionsSignal.set([]);
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

  invalidateDatabases(connectionId?: string): void {
    if (connectionId) {
      this.databasesSignal.update((map) => {
        const newMap = new Map(map);
        newMap.delete(connectionId);
        return newMap;
      });
      this.decentralizationApi.invalidateDatabases(connectionId);
    } else {
      this.databasesSignal.set(new Map());
    }
  }

  invalidateHealth(connectionId: string): void {
    this.healthCacheSignal.update((map) => {
      const newMap = new Map(map);
      newMap.delete(connectionId);
      return newMap;
    });
  }

  invalidateSystemMetrics(): void {
    this.systemMetricsSignal.set(null);
  }

  updateSystemMetrics(metrics: SystemMetrics): void {
    this.systemMetricsSignal.set(metrics);
  }

  async ensureConnectionsLoaded(): Promise<ConnectionSummary[]> {
    const cached = this.connectionsSignal();
    if (cached.length > 0) return cached;
    return this.refreshConnections();
  }

  async ensureDatabasesLoaded(connectionId: string): Promise<DatabaseMetadata[]> {
    const cached = this.databasesSignal().get(connectionId);
    if (cached && cached.length > 0) return cached;
    const result = await this.decentralizationApi.listDatabases(connectionId, 0, 50);
    this.updateDatabases(connectionId, result.databases);
    return result.databases;
  }

  async ensureCollectionsLoaded(connectionId: string, dbName?: string): Promise<CollectionMeta[]> {
    const cached = this.collectionsSignal().get(connectionId);
    if (cached && cached.length > 0) return cached;
    const collections = await this.db.listCollections(connectionId, dbName);
    this.updateCollections(connectionId, collections);
    return collections;
  }

  async ensureHealthLoaded(connectionId: string): Promise<ConnectionHealth> {
    return this.checkHealth(connectionId);
  }

  async ensureSchemaLoaded(collection: string): Promise<ColumnInfo[]> {
    return this.loadColumns(collection);
  }

  async ensureDataLoaded(
    collection: string,
    params: QueryParams = {}
  ): Promise<QueryResult<RowData>> {
    return this.queryData(collection, params, false);
  }

  async refreshConnections(): Promise<ConnectionSummary[]> {
    const connections = await this.db.listConnections();
    this.connectionsSignal.set(connections);
    return connections;
  }

  async refreshDatabases(connectionId: string): Promise<DatabaseMetadata[]> {
    this.invalidateDatabases(connectionId);
    const result = await this.decentralizationApi.listDatabases(connectionId, 0, 50);
    this.updateDatabases(connectionId, result.databases);
    return result.databases;
  }

  async refreshCollections(connectionId: string, dbName?: string): Promise<CollectionMeta[]> {
    this.invalidateCollections(connectionId);
    const collections = await this.db.listCollections(connectionId, dbName);
    this.updateCollections(connectionId, collections);
    return collections;
  }

  async refreshHealth(connectionId: string): Promise<ConnectionHealth> {
    this.invalidateHealth(connectionId);
    return this.checkHealth(connectionId);
  }

  async listDatabasesPaginated(
    connectionId: string,
    offset = 0,
    limit = 10
  ): Promise<DatabaseListResult> {
    return this.decentralizationApi.listDatabases(connectionId, offset, limit);
  }

  async listCollectionsPaginated(
    connectionId: string,
    dbName?: string,
    offset = 0,
    limit = 10
  ): Promise<CollectionListResult> {
    return this.collectionsApi.listCollections(connectionId, dbName, offset, limit);
  }

  async getFullConnection(id: string): Promise<any> {
    return this.db.getConnection(id);
  }

  async testConnection(config: TestConnectionConfig): Promise<ConnectionHealth> {
    return this.db.testConnection(config);
  }

  async saveConnection(config: TestConnectionConfig): Promise<string> {
    const result = await this.db.saveConnection(config);
    await this.refreshConnections();
    return result;
  }

  async deleteConnection(id: string): Promise<void> {
    await this.db.deleteConnection(id);
    this.removeConnection(id);
  }

  async saveDatabase(connId: string, name: string, path?: string): Promise<DatabaseMetadata> {
    const result = await this.decentralizationApi.saveDatabase(connId, name, path);
    await this.refreshDatabases(connId);
    return result;
  }

  async deleteDatabase(id: number): Promise<void> {
    await this.decentralizationApi.deleteDatabase(id);
  }

  async updateDatabase(id: number, name: string, path?: string): Promise<DatabaseMetadata> {
    const result = await this.decentralizationApi.updateDatabase(id, name, path);
    return result;
  }

  async getServerVersion(): Promise<string> {
    return this.db.getServerVersion();
  }

  async createCollection(name: string): Promise<void> {
    return this.db.createCollection(name);
  }

  async renameCollection(connId: string, oldName: string, newName: string): Promise<void> {
    return this.db.renameCollection(connId, oldName, newName);
  }

  async dropCollection(name: string): Promise<void> {
    return this.db.dropCollection(name);
  }

  async getCollectionStats(collection: string): Promise<CollectionStats> {
    return this.db.getCollectionStats(collection);
  }

  async describeCollection(collection: string): Promise<CollectionSchema> {
    return this.db.describeCollection(collection);
  }

  async saveRow(collection: string, data: Record<string, unknown>): Promise<unknown> {
    return this.db.saveRow(collection, data);
  }

  async deleteRow(collection: string, id: string): Promise<void> {
    return this.db.deleteRow(collection, id);
  }

  async executeRaw(sql: string): Promise<any> {
    return this.db.executeRaw(sql);
  }

  async testConnectionById(connId: string): Promise<ConnectionHealth | null> {
    return this.db.testConnectionById(connId);
  }

  async testConnectionStatus(connId: string): Promise<ConnectionSummary | null> {
    return this.db.testConnectionStatus(connId);
  }
}
