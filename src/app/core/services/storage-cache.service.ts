import { Injectable, signal, computed, Injector } from "@angular/core";
import { StorageEntityService } from "@shared/services/core/storage-entity.service";
import { CACHE_CONSTANTS } from "@shared/utils/constants";
const DEFAULT_CACHE_TTL_MS = CACHE_CONSTANTS.DEFAULT_TTL_MS;
const MAX_CACHE_SIZE = CACHE_CONSTANTS.MAX_CONNECTIONS_CACHE;
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  lastAccessed: number;
}
@Injectable({ providedIn: "root" })
export class StorageCacheService {
  private readonly entityService: StorageEntityService;
  private readonly reactiveCache = new Map<string, ReturnType<typeof computed<unknown>>>();
  private readonly cacheTimestamps = new Map<string, number>();
  private readonly inFlightRequests = new Map<string, Promise<unknown>>();
  readonly cacheInvalidated = signal(false);
  constructor(private injector: Injector) {
    this.entityService = injector.get(StorageEntityService);
  }
  hasCachedData(key: string): boolean {
    return this.reactiveCache.has(key);
  }
  getReactiveCache<T>(key: string): ReturnType<typeof computed<T>> | undefined {
    return this.reactiveCache.get(key) as ReturnType<typeof computed<T>> | undefined;
  }
  setReactiveCache<T>(key: string, value: ReturnType<typeof computed<T>>): void {
    this.reactiveCache.set(key, value);
  }
  getCacheTimestamp(key: string): number | undefined {
    return this.cacheTimestamps.get(key);
  }
  setCacheTimestamp(key: string, timestamp: number): void {
    this.cacheTimestamps.set(key, timestamp);
  }
  isCacheValid(key: string, ttlMs: number = DEFAULT_CACHE_TTL_MS): boolean {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;
    return Date.now() - timestamp < ttlMs;
  }
  isCacheFull(): boolean {
    return this.reactiveCache.size >= MAX_CACHE_SIZE;
  }
  evictOldestCache(): void {
    const sortedKeys = Array.from(this.cacheTimestamps.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, 10)
      .map(([key]) => key);
    for (const key of sortedKeys) {
      this.reactiveCache.delete(key);
      this.cacheTimestamps.delete(key);
    }
  }
  invalidateCache(): void {
    this.reactiveCache.clear();
    this.cacheTimestamps.clear();
    this.cacheInvalidated.set(true);
    setTimeout(() => this.cacheInvalidated.set(false), 0);
  }
  clearAll(): void {
    this.reactiveCache.clear();
    this.cacheTimestamps.clear();
    this.cacheInvalidated.set(true);
    setTimeout(() => this.cacheInvalidated.set(false), 0);
  }
  getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = DEFAULT_CACHE_TTL_MS
  ): Promise<T> {
    const existing = this.inFlightRequests.get(key);
    if (existing) {
      return existing as Promise<T>;
    }
    const requestPromise = (async () => {
      try {
        const result = await fetchFn();
        this.setCacheTimestamp(key, Date.now());
        return result;
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();
    this.inFlightRequests.set(key, requestPromise);
    return requestPromise;
  }
  hasInFlightRequest(key: string): boolean {
    return this.inFlightRequests.has(key);
  }
  getInFlightRequest<T>(key: string): Promise<T> | undefined {
    return this.inFlightRequests.get(key) as Promise<T> | undefined;
  }
}
