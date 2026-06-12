import { Injectable, signal, computed, inject } from "@angular/core";
import { AppLoggerService } from "@shared/services/app-logger.service";

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  totalEntries: number;
  memoryUsed: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
}

export interface CacheOptions {
  ttl?: number;
  key?: string;
}

@Injectable({ providedIn: "root" })
export class QueryCacheService {
  private logger = inject(AppLoggerService);
  private cache = new Map<string, CacheEntry>();
  private totalHits = 0;
  private totalMisses = 0;

  private statsSignal = signal<CacheStats>({
    totalEntries: 0,
    memoryUsed: 0,
    hitRate: 0,
    totalHits: 0,
    totalMisses: 0,
  });

  readonly stats = this.statsSignal.asReadonly();

  readonly entries = computed(() => {
    const allEntries: CacheEntry[] = [];
    this.cache.forEach((entry) => {
      allEntries.push(entry);
    });
    return allEntries.sort((a, b) => b.lastAccessed - a.lastAccessed);
  });

  getCachedResult<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.totalMisses++;
      this.updateStats();
      this.logger.debug("[QUERY_CACHE]", "Cache miss", { key });
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.totalMisses++;
      this.updateStats();
      this.logger.debug("[QUERY_CACHE]", "Cache expired", { key });
      return null;
    }

    entry.hitCount++;
    entry.lastAccessed = Date.now();
    this.totalHits++;
    this.updateStats();
    this.logger.debug("[QUERY_CACHE]", "Cache hit", { key, hitCount: entry.hitCount });
    return entry.value as T;
  }

  setCachedResult<T>(key: string, value: T, ttlSeconds = 300): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
      hitCount: 0,
      lastAccessed: now,
    };

    this.cache.set(key, entry as CacheEntry);
    this.updateStats();
    this.logger.debug("[QUERY_CACHE]", "Cached result", { key, ttlSeconds });
  }

  clearCache(key?: string): void {
    if (key) {
      this.logger.debug("[QUERY_CACHE]", "Clearing cache entry", { key });
      this.cache.delete(key);
    } else {
      this.logger.debug("[QUERY_CACHE]", "Clearing all cache");
      this.cache.clear();
    }
    this.updateStats();
  }

  clearExpired(): void {
    const now = Date.now();
    for (const [k, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(k);
      }
    }
    this.updateStats();
  }

  getCacheEntry(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry)) {
      return null;
    }
    return entry;
  }

  getCacheStatus(key: string): {
    cached: boolean;
    hitCount: number;
    age: number;
    ttlRemaining: number;
  } {
    const entry = this.cache.get(key);

    if (!entry || this.isExpired(entry)) {
      return { cached: false, hitCount: 0, age: 0, ttlRemaining: 0 };
    }

    const now = Date.now();
    return {
      cached: true,
      hitCount: entry.hitCount,
      age: now - entry.createdAt,
      ttlRemaining: Math.max(0, entry.expiresAt - now),
    };
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }

  private updateStats(): void {
    let memoryUsed = 0;

    this.cache.forEach((entry) => {
      const valueStr = JSON.stringify(entry.value);
      memoryUsed += valueStr.length * 2;
    });

    const totalRequests = this.totalHits + this.totalMisses;
    const hitRate = totalRequests > 0 ? (this.totalHits / totalRequests) * 100 : 0;

    this.statsSignal.set({
      totalEntries: this.cache.size,
      memoryUsed,
      hitRate,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
    });
  }

  resetStats(): void {
    this.totalHits = 0;
    this.totalMisses = 0;
    this.updateStats();
  }
}
