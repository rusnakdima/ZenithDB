import { Injectable, inject, signal } from "@angular/core";
import {
  QueryParams,
  QueryResult,
  RowData,
  ColumnInfo,
  CollectionSchema,
} from "@entities/entities.connection.config";
import { DatabaseService } from "@services/services.database.service";
import { CACHE_CONSTANTS } from "@shared/utils/constants";
import { evictLRUInPlace } from "@shared/utils/cache.utils";
export interface QueryCacheEntry {
  data: RowData[];
  total: number;
  queryParams: QueryParams;
}
interface ColumnsCacheEntry {
  columns: ColumnInfo[];
  timestamp: number;
  lastAccessed: number;
}
@Injectable({ providedIn: "root" })
export class QueryCacheService {
  private db = inject(DatabaseService);
  private readonly page = "QueryCacheService";
  private readonly DEFAULT_TTL_MS = CACHE_CONSTANTS.DEFAULT_TTL_MS;
  private readonly MAX_COLUMNS_CACHE_SIZE = CACHE_CONSTANTS.MAX_COLUMNS_CACHE_SIZE;
  private readonly MAX_ENTRIES_PER_COLLECTION = CACHE_CONSTANTS.MAX_ENTRIES_PER_COLLECTION;
  private columnsCacheSignal = signal<Map<string, ColumnsCacheEntry>>(new Map());
  private collectionDataCacheSignal = signal<Map<string, QueryCacheEntry>>(new Map());
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
    } catch (err) {
      throw err;
    }
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
  private evictLRUColumns(): void {
    evictLRUInPlace(this.columnsCacheSignal(), this.MAX_COLUMNS_CACHE_SIZE);
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
  async describeCollection(collection: string): Promise<CollectionSchema> {
    try {
      const result = await this.db.describeCollection(collection);
      return result;
    } catch (err) {
      throw err;
    }
  }
  async saveRow(collection: string, data: Record<string, unknown>): Promise<unknown> {
    try {
      const result = await this.db.saveRow(collection, data);
      return result;
    } catch (err) {
      throw err;
    }
  }
  async deleteRow(collection: string, id: string): Promise<void> {
    try {
      await this.db.deleteRow(collection, id);
    } catch (err) {
      throw err;
    }
  }
  async executeRaw(sql: string): Promise<import("@entities/entities.connection.config").RawResult> {
    try {
      const result = await this.db.executeRaw(sql);
      return result;
    } catch (err) {
      throw err;
    }
  }
}
