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
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { AppLoggerService } from "@shared/services/app-logger.service";

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
  private dataflowLogger = inject(DataflowLoggerService);
  private logger = inject(AppLoggerService);
  private readonly page = "DataStoreService";

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
    this.dataflowLogger.logApiCall(this.page, "checkHealth", "test_connection_by_id", {
      connectionId,
    });
    const startTime = performance.now();
    try {
      const cached = this.getHealth(connectionId);
      if (cached) {
        this.dataflowLogger.logDataReceive(
          this.page,
          "checkHealth",
          "test_connection_by_id",
          { cached: true },
          performance.now() - startTime
        );
        return cached;
      }

      const health = await this.db.testConnectionById(connectionId);
      const result = health ?? {
        healthy: false,
        provider: "unknown",
        latency_ms: 0,
        message: "Connection test failed",
      };

      this.updateHealth(connectionId, result);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "checkHealth",
        "test_connection_by_id",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "checkHealth",
        "test_connection_by_id",
        String(err),
        duration
      );
      throw err;
    }
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
        this.dataflowLogger.logQueryData(
          this.page,
          "queryData",
          "query_data",
          { collection, params },
          { cached: true },
          0
        );
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

    this.dataflowLogger.logApiCall(this.page, "queryData", "query_data", { collection, params });
    const startTime = performance.now();

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
        const duration = performance.now() - startTime;
        this.dataflowLogger.logQueryData(
          this.page,
          "queryData",
          "query_data",
          { collection, params },
          result,
          duration
        );
        return result as QueryResult<RowData>;
      } catch (err) {
        const duration = performance.now() - startTime;
        this.dataflowLogger.logError(this.page, "queryData", "query_data", String(err), duration);
        throw err;
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
    this.dataflowLogger.logApiCall(this.page, "refreshConnections", "list_connections", {});
    const startTime = performance.now();
    try {
      const connections = await this.db.listConnections();
      this.logger.debug("[DATASTORE]", "refreshConnections got connections", {
        count: connections.length,
      });
      this.connectionsSignal.set(connections);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "refreshConnections",
        "list_connections",
        { count: connections.length },
        duration
      );
      return connections;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "refreshConnections",
        "list_connections",
        String(err),
        duration
      );
      throw err;
    }
  }

  async refreshDatabases(connectionId: string): Promise<DatabaseMetadata[]> {
    this.dataflowLogger.logApiCall(this.page, "refreshDatabases", "database_list", {
      connectionId,
    });
    const startTime = performance.now();
    try {
      this.invalidateDatabases(connectionId);
      const result = await this.decentralizationApi.listDatabases(connectionId, 0, 50);
      this.updateDatabases(connectionId, result.databases);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "refreshDatabases",
        "database_list",
        { count: result.databases.length },
        duration
      );
      return result.databases;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "refreshDatabases",
        "database_list",
        String(err),
        duration
      );
      throw err;
    }
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
    this.dataflowLogger.logApiCall(this.page, "saveConnection", "save_connection", { config });
    const startTime = performance.now();
    try {
      const result = await this.db.saveConnection(config);
      await this.refreshConnections();
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "saveConnection",
        "save_connection",
        { id: result },
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "saveConnection",
        "save_connection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async deleteConnection(id: string): Promise<void> {
    this.dataflowLogger.logApiCall(this.page, "deleteConnection", "delete_connection", { id });
    const startTime = performance.now();
    try {
      await this.db.deleteConnection(id);
      this.removeConnection(id);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "deleteConnection",
        "delete_connection",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "deleteConnection",
        "delete_connection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async saveDatabase(connId: string, name: string, path?: string): Promise<DatabaseMetadata> {
    this.dataflowLogger.logApiCall(this.page, "saveDatabase", "save_database_metadata", {
      connId,
      name,
      path,
    });
    const startTime = performance.now();
    try {
      const result = await this.decentralizationApi.saveDatabase(connId, name, path);
      await this.refreshDatabases(connId);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "saveDatabase",
        "save_database_metadata",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "saveDatabase",
        "save_database_metadata",
        String(err),
        duration
      );
      throw err;
    }
  }

  async deleteDatabase(id: number): Promise<void> {
    this.dataflowLogger.logApiCall(this.page, "deleteDatabase", "delete_database_metadata", { id });
    const startTime = performance.now();
    try {
      await this.decentralizationApi.deleteDatabase(id);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "deleteDatabase",
        "delete_database_metadata",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "deleteDatabase",
        "delete_database_metadata",
        String(err),
        duration
      );
      throw err;
    }
  }

  async updateDatabase(id: number, name: string, path?: string): Promise<DatabaseMetadata> {
    this.dataflowLogger.logApiCall(this.page, "updateDatabase", "update_database_metadata", {
      id,
      name,
      path,
    });
    const startTime = performance.now();
    try {
      const result = await this.decentralizationApi.updateDatabase(id, name, path);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "updateDatabase",
        "update_database_metadata",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "updateDatabase",
        "update_database_metadata",
        String(err),
        duration
      );
      throw err;
    }
  }

  async getServerVersion(): Promise<string> {
    this.dataflowLogger.logApiCall(this.page, "getServerVersion", "get_server_version", {});
    const startTime = performance.now();
    try {
      const result = await this.db.getServerVersion();
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "getServerVersion",
        "get_server_version",
        { version: result },
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "getServerVersion",
        "get_server_version",
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

  async getCollectionStats(collection: string): Promise<CollectionStats> {
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

  async describeCollection(collection: string): Promise<CollectionSchema> {
    this.dataflowLogger.logApiCall(this.page, "describeCollection", "describe_collection", {
      collection,
    });
    const startTime = performance.now();
    try {
      const result = await this.db.describeCollection(collection);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "describeCollection",
        "describe_collection",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "describeCollection",
        "describe_collection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async saveRow(collection: string, data: Record<string, unknown>): Promise<unknown> {
    this.dataflowLogger.logApiCall(this.page, "saveRow", "save_row", { collection, data });
    const startTime = performance.now();
    try {
      const result = await this.db.saveRow(collection, data);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(this.page, "saveRow", "save_row", result, duration);
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(this.page, "saveRow", "save_row", String(err), duration);
      throw err;
    }
  }

  async deleteRow(collection: string, id: string): Promise<void> {
    this.dataflowLogger.logApiCall(this.page, "deleteRow", "delete_row", { collection, id });
    const startTime = performance.now();
    try {
      await this.db.deleteRow(collection, id);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "deleteRow",
        "delete_row",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(this.page, "deleteRow", "delete_row", String(err), duration);
      throw err;
    }
  }

  async executeRaw(sql: string): Promise<any> {
    this.dataflowLogger.logApiCall(this.page, "executeRaw", "execute_raw", { sql });
    const startTime = performance.now();
    try {
      const result = await this.db.executeRaw(sql);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "executeRaw",
        "execute_raw",
        { affectedRows: result?.affected_rows },
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(this.page, "executeRaw", "execute_raw", String(err), duration);
      throw err;
    }
  }

  async testConnectionById(connId: string): Promise<ConnectionHealth | null> {
    this.dataflowLogger.logApiCall(this.page, "testConnectionById", "test_connection_by_id", {
      connId,
    });
    const startTime = performance.now();
    try {
      const result = await this.db.testConnectionById(connId);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "testConnectionById",
        "test_connection_by_id",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "testConnectionById",
        "test_connection_by_id",
        String(err),
        duration
      );
      throw err;
    }
  }

  async testConnectionStatus(connId: string): Promise<ConnectionSummary | null> {
    this.dataflowLogger.logApiCall(this.page, "testConnectionStatus", "test_connection_status", {
      connId,
    });
    const startTime = performance.now();
    try {
      const result = await this.db.testConnectionStatus(connId);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "testConnectionStatus",
        "test_connection_status",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "testConnectionStatus",
        "test_connection_status",
        String(err),
        duration
      );
      throw err;
    }
  }
}
