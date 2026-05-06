import { Injectable, signal } from "@angular/core";
import { BaseStorageService } from "./base-storage.service";
import {
  ColumnInfo,
  ConnectionSummary,
  CollectionMeta,
  RowData,
  SystemMetrics,
} from "@shared/models/connection.config";

export interface CollectionData {
  name: string;
  data: RowData[];
  count: number;
}

export interface CachedItem<T> {
  data: T;
  timestamp: number;
  ttl?: number;
}

export interface CachedCollectionData {
  data: any[];
  total: number;
  columns: ColumnInfo[];
  cachedAt: number;
  queryParams: {
    filter?: any;
    page?: number;
    pageSize?: number;
    order_by?: string;
    direction?: string;
  };
}

const MAX_CACHE_SIZE = 100;
const MAX_COLLECTION_DATA_SIZE = 10000;

@Injectable({ providedIn: "root" })
export class StorageService extends BaseStorageService {
  private readonly connectionsSignal = signal<ConnectionSummary[]>([]);
  private readonly collectionsSignal = signal<CollectionMeta[]>([]);
  private readonly collectionDataSignal = signal<Map<string, CachedItem<CollectionData>>>(
    new Map()
  );
  private readonly collectionDataCache = signal<Map<string, CachedCollectionData>>(new Map());
  private readonly systemMetricsSignal = signal<SystemMetrics | null>(null);

  readonly connections = this.connectionsSignal.asReadonly();
  readonly collections = this.collectionsSignal.asReadonly();
  readonly systemMetrics = this.systemMetricsSignal.asReadonly();

  setConnections(connections: ConnectionSummary[]) {
    this.connectionsSignal.set(connections);
  }

  addConnection(connection: ConnectionSummary) {
    this.connectionsSignal.update((conns) => [...conns, connection]);
  }

  updateConnection(id: string, updates: Partial<ConnectionSummary>) {
    this.connectionsSignal.update((conns) =>
      conns.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }

  removeConnection(id: string) {
    this.connectionsSignal.update((conns) => conns.filter((c) => c.id !== id));
  }

  setCollections(collections: CollectionMeta[]) {
    this.collectionsSignal.set(collections);
  }

  getCollectionData(name: string): RowData[] | undefined {
    const cached = this.collectionDataSignal().get(name);
    if (!cached) return undefined;
    if (cached.ttl && Date.now() - cached.timestamp > cached.ttl) {
      this.clearExpired(name);
      return undefined;
    }
    return cached.data.data;
  }

  setCollectionData(name: string, data: RowData[], count: number, ttl?: number) {
    this.collectionDataSignal.update((map) => {
      const newMap = new Map(map);
      if (newMap.size >= MAX_CACHE_SIZE) {
        const oldestKey = [...newMap.entries()].sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        )[0][0];
        newMap.delete(oldestKey);
      }
      const truncatedData =
        data.length > MAX_COLLECTION_DATA_SIZE ? data.slice(0, MAX_COLLECTION_DATA_SIZE) : data;
      const truncatedCount = data.length > MAX_COLLECTION_DATA_SIZE ? data.length : count;
      newMap.set(name, {
        data: { name, data: truncatedData, count: truncatedCount },
        timestamp: Date.now(),
        ttl,
      });
      return newMap;
    });
  }

  updateCollectionData(name: string, data: RowData[]) {
    this.collectionDataSignal.update((map) => {
      const newMap = new Map(map);
      const existing = newMap.get(name);
      const newData = { name, data, count: data.length };
      newMap.set(name, {
        data: newData,
        timestamp: existing?.timestamp ?? Date.now(),
        ttl: existing?.ttl,
      });
      return newMap;
    });
  }

  addToCollectionData(name: string, item: RowData) {
    this.collectionDataSignal.update((map) => {
      const newMap = new Map(map);
      const existing = newMap.get(name);
      if (existing) {
        const newData = {
          ...existing.data,
          data: [item, ...existing.data.data],
          count: existing.data.count + 1,
        };
        newMap.set(name, { data: newData, timestamp: existing.timestamp, ttl: existing.ttl });
      } else {
        newMap.set(name, { data: { name, data: [item], count: 1 }, timestamp: Date.now() });
      }
      return newMap;
    });
  }

  removeFromCollectionData(collectionName: string, id: string) {
    this.collectionDataSignal.update((map) => {
      const newMap = new Map(map);
      const existing = newMap.get(collectionName);
      if (existing) {
        const filteredData = existing.data.data.filter((d) => (d as RowData)["id"] !== id);
        newMap.set(collectionName, {
          ...existing,
          data: { ...existing.data, data: filteredData, count: filteredData.length },
        });
      }
      return newMap;
    });
  }

  clearCollectionData(name: string) {
    this.collectionDataSignal.update((map) => {
      const newMap = new Map(map);
      newMap.delete(name);
      return newMap;
    });
  }

  clearExpired(name?: string) {
    this.collectionDataSignal.update((map) => {
      const newMap = new Map(map);
      const now = Date.now();
      if (name) {
        const cached = newMap.get(name);
        if (cached && cached.ttl && now - cached.timestamp > cached.ttl) {
          newMap.delete(name);
        }
      } else {
        for (const [key, cached] of newMap) {
          if (cached.ttl && now - cached.timestamp > cached.ttl) {
            newMap.delete(key);
          }
        }
      }
      return newMap;
    });
  }

  setSystemMetrics(metrics: SystemMetrics) {
    this.systemMetricsSignal.set(metrics);
  }

  getItem<T>(key: string): T | null {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as T;
    } catch {
      return null;
    }
  }

  setItem<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
}
