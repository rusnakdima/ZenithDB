export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  lastAccessed: number;
}

export function createCacheEntry<T>(data: T): CacheEntry<T> {
  return { data, timestamp: Date.now(), lastAccessed: Date.now() };
}

export function updateLastAccessed(entry: CacheEntry<unknown>): void {
  entry.lastAccessed = Date.now();
}
