import { Injectable, signal, computed } from "@angular/core";
import { BaseStorageService } from "./base-storage.service";
import { ConnectionSummary, CollectionMeta, CollectionSchema, SystemMetrics } from "@shared/models/connection.config";

export interface CollectionData {
  name: string;
  data: any[];
  count: number;
}

@Injectable({ providedIn: "root" })
export class StorageService extends BaseStorageService {
  private readonly connectionsSignal = signal<ConnectionSummary[]>([]);
  private readonly collectionsSignal = signal<CollectionMeta[]>([]);
  private readonly collectionDataSignal = signal<Map<string, CollectionData>>(new Map());
  private readonly activeConnectionSignal = signal<string | null>(null);
  private readonly systemMetricsSignal = signal<SystemMetrics | null>(null);

  readonly connections = this.connectionsSignal.asReadonly();
  readonly collections = this.collectionsSignal.asReadonly();
  readonly activeConnectionId = this.activeConnectionSignal.asReadonly();
  readonly systemMetrics = this.systemMetricsSignal.asReadonly();

  readonly activeConnectionName = computed(() => {
    const id = this.activeConnectionId();
    if (!id) return null;
    const conn = this.connectionsSignal().find(c => c.id === id);
    return conn?.name ?? null;
  });

  readonly activeProvider = computed(() => {
    const id = this.activeConnectionId();
    if (!id) return null;
    const conn = this.connectionsSignal().find(c => c.id === id);
    return conn?.provider ?? null;
  });

  setConnections(connections: ConnectionSummary[]) {
    this.connectionsSignal.set(connections);
  }

  addConnection(connection: ConnectionSummary) {
    this.connectionsSignal.update(conns => [...conns, connection]);
  }

  updateConnection(id: string, updates: Partial<ConnectionSummary>) {
    this.connectionsSignal.update(conns =>
      conns.map(c => c.id === id ? { ...c, ...updates } : c)
    );
  }

  removeConnection(id: string) {
    this.connectionsSignal.update(conns => conns.filter(c => c.id !== id));
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
    return this.collectionDataSignal().get(name)?.data;
  }

  setCollectionData(name: string, data: any[], count: number) {
    this.collectionDataSignal.update(map => {
      const newMap = new Map(map);
      newMap.set(name, { name, data, count });
      return newMap;
    });
  }

  updateCollectionData(name: string, data: any[]) {
    this.collectionDataSignal.update(map => {
      const newMap = new Map(map);
      const existing = newMap.get(name);
      newMap.set(name, { name, data, count: data.length });
      return newMap;
    });
  }

  addToCollectionData(name: string, item: any) {
    this.collectionDataSignal.update(map => {
      const newMap = new Map(map);
      const existing = newMap.get(name);
      if (existing) {
        newMap.set(name, { ...existing, data: [item, ...existing.data], count: existing.count + 1 });
      } else {
        newMap.set(name, { name, data: [item], count: 1 });
      }
      return newMap;
    });
  }

  removeFromCollectionData(collectionName: string, id: string) {
    this.collectionDataSignal.update(map => {
      const newMap = new Map(map);
      const existing = newMap.get(collectionName);
      if (existing) {
        newMap.set(collectionName, {
          ...existing,
          data: existing.data.filter((d: any) => d.id !== id),
          count: existing.count - 1
        });
      }
      return newMap;
    });
  }

  clearCollectionData(name: string) {
    this.collectionDataSignal.update(map => {
      const newMap = new Map(map);
      newMap.delete(name);
      return newMap;
    });
  }

  setSystemMetrics(metrics: SystemMetrics) {
    this.systemMetricsSignal.set(metrics);
  }
}