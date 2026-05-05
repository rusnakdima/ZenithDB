import { Injectable, signal, inject } from "@angular/core";
import { DatabaseService } from "./database.service";
import { StorageService } from "@services/core/storage.service";
import { ConnectionStateService } from "./connection-state.service";
import { QueryParams, QueryResult, ColumnInfo, RowData } from "@shared/models/connection.config";

interface CachedCollectionData {
  data: any[];
  total: number;
  columns: ColumnInfo[];
  cachedAt: number;
  queryParams: {
    filter?: any;
    skip?: number;
    limit?: number;
    order_by?: string;
    direction?: string;
  };
}

interface DataProviderParams {
  collection: string;
  filter?: any;
  skip?: number;
  limit?: number;
  order_by?: string;
  direction?: string;
}

@Injectable({ providedIn: "root" })
export class DataProviderService {
  private db = inject(DatabaseService);
  private storage = inject(StorageService);
  private connectionState = inject(ConnectionStateService);

  private collectionDataCache = signal<Map<string, CachedCollectionData>>(new Map());
  currentParams = signal<DataProviderParams | null>(null);
  isDataLoaded = signal<boolean>(false);
  loading = signal<boolean>(false);

  private readonly CACHE_TTL = 5 * 60 * 1000;

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

  private isCacheValid(key: string): boolean {
    const cache = this.collectionDataCache().get(key);
    if (!cache) return false;
    const now = Date.now();
    return now - cache.cachedAt < this.CACHE_TTL;
  }

  async loadData(params: DataProviderParams): Promise<QueryResult> {
    const cacheKey = this.generateCacheKey(params);

    if (this.isCacheValid(cacheKey)) {
      const cached = this.collectionDataCache().get(cacheKey);
      if (cached) {
        this.currentParams.set(params);
        this.isDataLoaded.set(true);
        return {
          data: cached.data,
          total: cached.total,
          has_more: false,
        };
      }
    }

    this.loading.set(true);
    try {
      const queryParams: QueryParams = {
        filter: params.filter,
        skip: params.skip,
        limit: params.limit,
        order_by: params.order_by,
        direction: params.direction,
      };
      const result = await this.db.queryData(params.collection, queryParams);

      const cachedData: CachedCollectionData = {
        data: result.data,
        total: result.total,
        columns: [],
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
    }
  }

  getCachedData(params: DataProviderParams): CachedCollectionData | null {
    const key = this.generateCacheKey(params);
    return this.collectionDataCache().get(key) || null;
  }

  async updateFilters(collection: string, filter: any): Promise<void> {
    const current = this.currentParams();
    if (!current || current.collection !== collection) return;

    await this.loadData({
      ...current,
      filter,
      skip: 0,
    });
  }

  async updatePage(collection: string, skip: number): Promise<void> {
    const current = this.currentParams();
    if (!current || current.collection !== collection) return;

    await this.loadData({
      ...current,
      skip,
    });
  }

  async updatePageSize(collection: string, limit: number): Promise<void> {
    const current = this.currentParams();
    if (!current || current.collection !== collection) return;

    await this.loadData({
      ...current,
      limit,
      skip: 0,
    });
  }

  updateColumns(columns: string[]): void {
    // Column visibility is handled locally in DataGridComponent
    // This method is a no-op to maintain API compatibility
  }

  clearCache(collection?: string): void {
    if (collection) {
      const cache = this.collectionDataCache();
      const newCache = new Map(cache);
      for (const key of newCache.keys()) {
        if (key.startsWith(collection + "_")) {
          newCache.delete(key);
        }
      }
      this.collectionDataCache.set(newCache);
    } else {
      this.collectionDataCache.set(new Map());
    }
  }

  setData(
    collection: string,
    data: RowData[],
    total: number,
    columns: ColumnInfo[],
    params: DataProviderParams
  ): void {
    const cacheKey = this.generateCacheKey({ ...params, collection });

    const cachedData: CachedCollectionData = {
      data,
      total,
      columns,
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
  }
}
