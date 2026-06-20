export interface LRUEntry {
  lastAccessed: number;
}
export function evictLRU<T extends LRUEntry>(
  cache: Map<string, T>,
  maxSize: number
): Map<string, T> {
  if (cache.size <= maxSize) {
    return cache;
  }
  const sorted = Array.from(cache.entries()).sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
  const toRemove = sorted.slice(0, cache.size - maxSize);
  const newCache = new Map(cache);
  for (const [key] of toRemove) {
    newCache.delete(key);
  }
  return newCache;
}
export function evictLRUInPlace<T extends LRUEntry>(map: Map<string, T>, maxSize: number): void {
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
export function isStale(timestamp: number, ttlMs: number): boolean {
  return Date.now() - timestamp > ttlMs;
}
