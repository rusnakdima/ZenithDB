import { Injectable, signal, inject } from "@angular/core";
import { DatabaseService } from "./database.service";
import { ColumnInfo, RowData, QueryParams, QueryResult, FilterExpression } from "@shared/models/connection.config";

export interface DataProviderParams {
  collection: string;
  filter?: FilterExpression;
  skip?: number;
  limit?: number;
  order_by?: string;
  direction?: string;
}

interface CacheEntry {
  data: RowData[];
  total: number;
  lastAccessed: number;
  cachedAt: number;
  queryParams: QueryParams;
}

interface ColumnsCacheEntry {
  columns: ColumnInfo[];
  timestamp: number;
  lastAccessed: number;
}

@Injectable({ providedIn: "root" })
export class DataProviderService {
  private db = inject(DatabaseService);

  private readonly MAX_ENTRIES_PER_COLLECTION = 50;
  private readonly COLUMNS_CACHE_TTL = 5 * 60 * 1000;
  private readonly MAX_COLUMNS_CACHE_SIZE = 100;

  private collectionDataCache = signal<Map<string, CacheEntry>>(new Map());
  private columnsCache = signal<Map<string, ColumnsCacheEntry>>(new Map());
  private inFlightRequests = new Map<string, Promise<QueryResult>>();

  currentParams = signal<DataProviderParams | null>(null);
  isDataLoaded = signal<boolean>(false);
  loading = signal<boolean>(false);

  generateCacheKey(params: DataProviderParams): string {
    const cacheParams = {
      filter: params.filter,
      skip: params.skip,
      limit: params.limit,
      order_by: params.order_by,
      direction: params.direction,
    };
    const filterJson = JSON.stringify(cacheParams.filter || {});
    return `${params.collection}_${filterJson}_${cacheParams.skip}_${cacheParams.limit}`;
  }

  private getCollectionEntries(collection: string): Map<string, CacheEntry> {
    const cache = this.collectionDataCache();
    const entries = new Map<string, CacheEntry>();
    for (const [key, entry] of cache.entries()) {
      if (key.startsWith(collection + "_")) {
        entries.set(key, entry);
      }
    }
    return entries;
  }

  private evictLRU(collection: string): void {
    const entries = this.getCollectionEntries(collection);
    if (entries.size >= this.MAX_ENTRIES_PER_COLLECTION) {
      const sorted = Array.from(entries.entries()).sort(
        (a, b) => a[1].lastAccessed - b[1].lastAccessed
      );
      const toRemove = sorted.slice(0, entries.size - this.MAX_ENTRIES_PER_COLLECTION + 1);
      const cache = this.collectionDataCache();
      for (const [key] of toRemove) {
        cache.delete(key);
      }
      this.collectionDataCache.set(new Map(cache));
    }
  }

  private evictLRUColumns(): void {
    const cache = this.columnsCache();
    if (cache.size >= this.MAX_COLUMNS_CACHE_SIZE) {
      const sorted = Array.from(cache.entries()).sort(
        (a, b) => a[1].lastAccessed - b[1].lastAccessed
      );
      const toRemove = sorted.slice(0, cache.size - this.MAX_COLUMNS_CACHE_SIZE + 1);
      for (const [key] of toRemove) {
        cache.delete(key);
      }
      this.columnsCache.set(new Map(cache));
    }
  }

  private updateAccessTime(key: string): void {
    const cache = this.collectionDataCache();
    const entry = cache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      this.collectionDataCache.set(new Map(cache));
    }
  }

  async loadData(params: DataProviderParams, forceRefresh?: boolean): Promise<QueryResult> {
    const cacheKey = this.generateCacheKey(params);

    if (!forceRefresh) {
      const cached = this.collectionDataCache().get(cacheKey);
      if (cached) {
        cached.lastAccessed = Date.now();
        this.collectionDataCache.set(new Map(this.collectionDataCache()));
        this.currentParams.set(params);
        this.isDataLoaded.set(true);
        return {
          data: cached.data,
          total: cached.total,
          has_more: false,
        };
      }
    }

    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey)!;
    }

    this.loading.set(true);
    const requestPromise = (async () => {
      try {
        const queryParams: QueryParams = {
          filter: params.filter,
          skip: params.skip,
          limit: params.limit,
          order_by: params.order_by,
          direction: params.direction,
        };
        const result = await this.db.queryData(params.collection, queryParams);

        this.evictLRU(params.collection);

        const cachedData: CacheEntry = {
          data: result.data,
          total: result.total,
          lastAccessed: Date.now(),
          cachedAt: Date.now(),
          queryParams: {
            filter: params.filter,
            skip: params.skip,
            limit: params.limit,
            order_by: params.order_by,
            direction: params.direction,
          },
        };

        const cache = this.collectionDataCache();
        cache.set(cacheKey, cachedData);
        this.collectionDataCache.set(new Map(cache));

        this.currentParams.set(params);
        this.isDataLoaded.set(true);
        return result;
      } finally {
        this.loading.set(false);
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  async loadColumns(collection: string, forceRefresh?: boolean): Promise<ColumnInfo[]> {
    const cacheKey = `${collection}_schema`;
    const cached = this.columnsCache().get(cacheKey);

    if (!forceRefresh && cached) {
      if (Date.now() - cached.timestamp < this.COLUMNS_CACHE_TTL) {
        cached.lastAccessed = Date.now();
        this.columnsCache.set(new Map(this.columnsCache()));
        return cached.columns;
      }
    }

    this.evictLRUColumns();

    const schema = await this.db.describeCollection(collection);
    const columns = schema.columns;
    this.columnsCache.set(
      new Map(this.columnsCache()).set(cacheKey, {
        columns,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
      })
    );
    return columns;
  }

  invalidateCache(collection: string): void {
    const cache = this.collectionDataCache();
    const keysToDelete: string[] = [];
    for (const key of cache.keys()) {
      if (key.startsWith(collection + "_")) {
        keysToDelete.push(key);
      }
    }
    if (keysToDelete.length > 0) {
      const newCache = new Map(cache);
      for (const key of keysToDelete) {
        newCache.delete(key);
      }
      this.collectionDataCache.set(newCache);
    }
  }

  invalidateColumnsCache(collection?: string): void {
    const cache = this.columnsCache();
    if (collection) {
      const key = `${collection}_schema`;
      if (cache.has(key)) {
        const newCache = new Map(cache);
        newCache.delete(key);
        this.columnsCache.set(newCache);
      }
    } else {
      this.columnsCache.set(new Map());
    }
  }
}
