import { Injectable, signal, Signal, inject } from "@angular/core";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";

@Injectable({ providedIn: "root" })
export class CacheService {
  protected inFlightRequests = new Map<string, Promise<unknown>>();
  protected readonly logger = inject(DataflowLoggerService, { optional: true });

  protected getOrFetch<T>(
    cacheKeyOrMap: string | Map<string, T> | Signal<Map<string, T>>,
    keyOrFetchFn: string | (() => Promise<T>),
    fetchFnOrTtl?: (() => Promise<T>) | number,
    maybeTtl?: number
  ): Promise<T> {
    if (typeof cacheKeyOrMap === "string") {
      const cacheKey = cacheKeyOrMap;
      const fetchFn = keyOrFetchFn as () => Promise<T>;
      const existing = this.inFlightRequests.get(cacheKey);
      if (existing) {
        this.logger?.logApiCall("cache", "getOrFetch (in-flight)", "cache", { cacheKey });
        return existing as Promise<T>;
      }

      const promise = fetchFn().finally(() => {
        this.inFlightRequests.delete(cacheKey);
      });

      this.inFlightRequests.set(cacheKey, promise as Promise<unknown>);
      this.logger?.logApiCall("cache", "getOrFetch (new)", "cache", {
        cacheKey,
        cacheSize: this.inFlightRequests.size,
      });
      return promise;
    }

    const cache = cacheKeyOrMap;
    const key = keyOrFetchFn as string;
    const fetchFn = fetchFnOrTtl as () => Promise<T>;

    const map = cache instanceof Map ? cache : cache();
    const cached = map.get(key);
    if (cached !== undefined) {
      this.logger?.logDataReceive("cache", "getOrFetch (hit)", "cache", { key, cached: true });
      return Promise.resolve(cached);
    }

    const existing = this.inFlightRequests.get(key);
    if (existing) {
      this.logger?.logApiCall("cache", "getOrFetch (in-flight)", "cache", { key });
      return existing as Promise<T>;
    }

    const promise = fetchFn().finally(() => {
      this.inFlightRequests.delete(key);
    });

    this.inFlightRequests.set(key, promise as Promise<unknown>);
    this.logger?.logApiCall("cache", "getOrFetch (new)", "cache", {
      key,
      inFlightSize: this.inFlightRequests.size,
    });
    return promise;
  }

  protected evictLRUIfNeeded<K, V>(
    map: Map<K, { data: V; lastAccessed: number }>,
    maxSize: number
  ): void {
    if (map.size <= maxSize) {
      return;
    }

    const entries = Array.from(map.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const toEvict = entries.slice(0, map.size - maxSize);
    for (const [evictKey] of toEvict) {
      map.delete(evictKey);
    }
    this.logger?.logUserAction("cache", "evictLRU", {
      evictedCount: toEvict.length,
      remainingSize: map.size,
    });
  }

  protected isStale(timestamp: number, ttlMs: number): boolean {
    return Date.now() - timestamp > ttlMs;
  }
}
