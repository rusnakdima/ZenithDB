import { Injectable, inject, signal, computed, Injector } from "@angular/core";
import {
  ConnectionSummary,
  SystemMetrics,
  DatabaseMetadata,
  QueryParams,
  QueryResult,
  RowData,
  CollectionMeta,
  ColumnInfo,
  CollectionStats,
  TestConnectionConfig,
  CollectionSchema,
  RawResult,
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
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { getLoggingService } from "@tauri-apps/logger";
import { CACHE_CONSTANTS } from "@shared/utils/constants";
import { evictLRUInPlace } from "@shared/utils/cache.utils";
import { ConnectionCacheService } from "./connection-cache.service";
import { CollectionCacheService } from "./collection-cache.service";
import { QueryCacheService } from "./storage-query.service";

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  lastAccessed: number;
  ttl: number;
}

@Injectable({ providedIn: "root" })
export class DataStoreService {
  private injector = inject(Injector);
  private decentralizationApi = inject(DecentralizationApiService);
  private collectionsApi = inject(CollectionsApiService);
  private dataflowLogger = inject(DataflowLoggerService);
  private logger = getLoggingService();
  private readonly page = "DataStoreService";

  connectionCache = inject(ConnectionCacheService);
  collectionCache = inject(CollectionCacheService);
  queryCache = inject(QueryCacheService);

  private get db(): DatabaseService {
    return this.injector.get(DatabaseService);
  }

  private readonly DEFAULT_TTL_MS = CACHE_CONSTANTS.DEFAULT_TTL_MS;
  private readonly MAX_CONNECTIONS_CACHE = CACHE_CONSTANTS.MAX_CONNECTIONS_CACHE;

  private databasesSignal = signal<Map<string, DatabaseMetadata[]>>(new Map());
  private systemMetricsSignal = signal<SystemMetrics | null>(null);

  private genericCache = signal<Map<string, CacheEntry<unknown>>>(new Map());
  private inFlightRequests = new Map<string, Promise<unknown>>();

  readonly databases = computed(() => {
    const map = this.databasesSignal();
    const result: DatabaseMetadata[] = [];
    for (const dbs of map.values()) {
      result.push(...dbs);
    }
    return result;
  });
  readonly systemMetrics = this.systemMetricsSignal.asReadonly();
  readonly connections = computed(() => this.connectionCache.getConnections());

  getConnections(): ConnectionSummary[] {
    return this.connectionCache.getConnections();
  }

  getConnection(id: string): ConnectionSummary | undefined {
    return this.connectionCache.getConnection(id);
  }

  updateConnections(connections: ConnectionSummary[]): void {
    this.connectionCache.updateConnections(connections);
  }

  removeConnection(id: string): void {
    this.connectionCache.removeConnection(id);
  }

  updateConnection(id: string, updates: Partial<ConnectionSummary>): void {
    this.connectionCache.updateConnection(id, updates);
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
    return this.collectionCache.getCollections(connectionId);
  }

  getCollection(connectionId: string, name: string): CollectionMeta | undefined {
    return this.collectionCache.getCollection(connectionId, name);
  }

  updateCollections(connectionId: string, collections: CollectionMeta[]): void {
    this.collectionCache.updateCollections(connectionId, collections);
  }

  getHealth(connectionId: string) {
    return this.connectionCache.getHealth(connectionId);
  }

  updateHealth(
    connectionId: string,
    health: import("@shared/models/connection.config").ConnectionHealth
  ): void {
    this.connectionCache.updateHealth(connectionId, health);
  }

  async checkHealth(connectionId: string) {
    return this.connectionCache.checkHealth(connectionId);
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
    this.databasesSignal.set(new Map());
    this.systemMetricsSignal.set(null);
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

    const existing = this.inFlightRequests.get(key);
    if (existing) {
      return existing as Promise<T>;
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

    this.inFlightRequests.set(key, requestPromise);
    return requestPromise;
  }

  async queryData(
    collection: string,
    params: QueryParams = {},
    forceRefresh = false
  ): Promise<QueryResult<RowData>> {
    return this.queryCache.queryData(collection, params, forceRefresh);
  }

  async loadColumns(collection: string, forceRefresh = false): Promise<ColumnInfo[]> {
    return this.queryCache.loadColumns(collection, forceRefresh);
  }

  invalidateCollectionCache(collection: string): void {
    this.queryCache.invalidateCollectionCache(collection);
  }

  invalidateColumnsCache(collection?: string): void {
    this.queryCache.invalidateColumnsCache(collection);
  }

  invalidateConnections(): void {
    this.connectionCache.invalidateConnections();
  }

  invalidateCollections(connectionId?: string): void {
    this.collectionCache.invalidateCollections(connectionId);
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
    this.connectionCache.invalidateHealth(connectionId);
  }

  invalidateSystemMetrics(): void {
    this.systemMetricsSignal.set(null);
  }

  updateSystemMetrics(metrics: SystemMetrics): void {
    this.systemMetricsSignal.set(metrics);
  }

  async ensureConnectionsLoaded(): Promise<ConnectionSummary[]> {
    return this.connectionCache.ensureConnectionsLoaded();
  }

  async ensureDatabasesLoaded(connectionId: string): Promise<DatabaseMetadata[]> {
    const cached = this.databasesSignal().get(connectionId);
    if (cached && cached.length > 0) return cached;
    const result = await this.decentralizationApi.listDatabases(connectionId, 0, 50);
    this.updateDatabases(connectionId, result.databases);
    return result.databases;
  }

  async ensureCollectionsLoaded(connectionId: string, dbName?: string): Promise<CollectionMeta[]> {
    return this.collectionCache.ensureCollectionsLoaded(connectionId, dbName);
  }

  async ensureHealthLoaded(connectionId: string) {
    return this.connectionCache.ensureHealthLoaded(connectionId);
  }

  async ensureSchemaLoaded(collection: string): Promise<ColumnInfo[]> {
    return this.queryCache.ensureSchemaLoaded(collection);
  }

  async ensureDataLoaded(
    collection: string,
    params: QueryParams = {}
  ): Promise<QueryResult<RowData>> {
    return this.queryCache.ensureDataLoaded(collection, params);
  }

  async refreshConnections(): Promise<ConnectionSummary[]> {
    return this.connectionCache.refreshConnections();
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
    return this.collectionCache.refreshCollections(connectionId, dbName);
  }

  async refreshHealth(connectionId: string) {
    return this.connectionCache.refreshHealth(connectionId);
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

  async getFullConnection(
    id: string
  ): Promise<import("@shared/models/connection.config").ConnectionConfigResult> {
    return this.db.getConnection(id);
  }

  async testConnection(config: TestConnectionConfig) {
    return this.connectionCache.testConnection(config);
  }

  async saveConnection(config: TestConnectionConfig): Promise<string> {
    return this.connectionCache.saveConnection(config);
  }

  async deleteConnection(id: string): Promise<void> {
    return this.connectionCache.deleteConnection(id);
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
    return this.collectionCache.createCollection(name);
  }

  async renameCollection(connId: string, oldName: string, newName: string): Promise<void> {
    return this.collectionCache.renameCollection(connId, oldName, newName);
  }

  async dropCollection(name: string): Promise<void> {
    return this.collectionCache.dropCollection(name);
  }

  async getCollectionStats(collection: string): Promise<CollectionStats> {
    return this.collectionCache.getCollectionStats(collection);
  }

  async describeCollection(collection: string): Promise<CollectionSchema> {
    return this.queryCache.describeCollection(collection);
  }

  async saveRow(collection: string, data: Record<string, unknown>): Promise<unknown> {
    return this.queryCache.saveRow(collection, data);
  }

  async deleteRow(collection: string, id: string): Promise<void> {
    return this.queryCache.deleteRow(collection, id);
  }

  async executeRaw(sql: string): Promise<RawResult> {
    return this.queryCache.executeRaw(sql);
  }

  async testConnectionById(connId: string) {
    return this.connectionCache.testConnectionById(connId);
  }

  async testConnectionStatus(connId: string) {
    return this.connectionCache.testConnectionStatus(connId);
  }
}
