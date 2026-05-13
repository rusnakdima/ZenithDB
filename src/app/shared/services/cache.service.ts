import { Injectable, signal, Signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class CacheService {
  protected inFlightRequests = new Map<string, Promise<unknown>>();

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
        return existing as Promise<T>;
      }

      const promise = fetchFn().finally(() => {
        this.inFlightRequests.delete(cacheKey);
      });

      this.inFlightRequests.set(cacheKey, promise as Promise<unknown>);
      return promise;
    }

    const cache = cacheKeyOrMap;
    const key = keyOrFetchFn as string;
    const fetchFn = fetchFnOrTtl as () => Promise<T>;

    const map = cache instanceof Map ? cache : cache();
    const cached = map.get(key);
    if (cached !== undefined) {
      return Promise.resolve(cached);
    }

    const existing = this.inFlightRequests.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = fetchFn().finally(() => {
      this.inFlightRequests.delete(key);
    });

    this.inFlightRequests.set(key, promise as Promise<unknown>);
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
  }

  protected isStale(timestamp: number, ttlMs: number): boolean {
    return Date.now() - timestamp > ttlMs;
  }
}
