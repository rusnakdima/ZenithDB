import { Injectable, signal, computed } from "@angular/core";
import { BaseStorageService } from "./base-storage.service";
import {
  ConnectionSummary,
  CollectionMeta,
  CollectionSchema,
  SystemMetrics,
} from "@shared/models/connection.config";

export interface CollectionData {
  name: string;
  data: any[];
  count: number;
}

export interface CachedItem<T> {
  data: T;
  timestamp: number;
  ttl?: number;
}

const MAX_CACHE_SIZE = 100;

@Injectable({ providedIn: "root" })
export class StorageService extends BaseStorageService {
  private readonly connectionsSignal = signal<ConnectionSummary[]>([]);
  private readonly collectionsSignal = signal<CollectionMeta[]>([]);
  private readonly collectionDataSignal = signal<Map<string, CachedItem<CollectionData>>>(
    new Map()
  );
  private readonly activeConnectionSignal = signal<string | null>(null);
  private readonly systemMetricsSignal = signal<SystemMetrics | null>(null);

  readonly connections = this.connectionsSignal.asReadonly();
  readonly collections = this.collectionsSignal.asReadonly();
  readonly activeConnectionId = this.activeConnectionSignal.asReadonly();
  readonly systemMetrics = this.systemMetricsSignal.asReadonly();

  readonly activeConnectionName = computed(() => {
    const id = this.activeConnectionId();
    if (!id) return null;
    const conn = this.connectionsSignal().find((c) => c.id === id);
    return conn?.name ?? null;
  });

  readonly activeProvider = computed(() => {
    const id = this.activeConnectionId();
    if (!id) return null;
    const conn = this.connectionsSignal().find((c) => c.id === id);
    return conn?.provider ?? null;
  });

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
    if (this.activeConnectionId() === id) {
      this.activeConnectionSignal.set(null);
    }
  }

  setActiveConnection(id: string | null) {
    this.activeConnectionSignal.set(id);
    if (!id) {
      this.collectionsSignal.set([]);
      this.collectionDataSignal.set(new Map());
    }
  }

  setCollections(collections: CollectionMeta[]) {
    this.collectionsSignal.set(collections);
  }

  getCollectionData(name: string): any[] | undefined {
    const cached = this.collectionDataSignal().get(name);
    if (!cached) return undefined;
    if (cached.ttl && Date.now() - cached.timestamp > cached.ttl) {
      this.clearExpired(name);
      return undefined;
    }
    return cached.data.data;
  }

  setCollectionData(name: string, data: any[], count: number, ttl?: number) {
    this.collectionDataSignal.update((map) => {
      const newMap = new Map(map);
      if (newMap.size >= MAX_CACHE_SIZE) {
        const oldestKey = [...newMap.entries()].sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        )[0][0];
        newMap.delete(oldestKey);
      }
      newMap.set(name, { data: { name, data, count }, timestamp: Date.now(), ttl });
      return newMap;
    });
  }

  updateCollectionData(name: string, data: any[]) {
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

  addToCollectionData(name: string, item: any) {
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
        const filteredData = existing.data.data.filter((d: any) => d.id !== id);
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
}
