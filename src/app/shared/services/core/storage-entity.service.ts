import { Injectable, signal, computed } from "@angular/core";
import {
  ConnectionSummary,
  CollectionMeta,
  ColumnInfo,
  RowData,
  CollectionStats,
} from "@app/models/connection.config";

export interface DatabaseMeta {
  name: string;
  size_bytes?: number;
  table_count?: number;
}

@Injectable({ providedIn: "root" })
export class StorageEntityService {
  readonly connections = signal<ConnectionSummary[]>([]);
  readonly collections = signal<Map<string, CollectionMeta[]>>(new Map());
  readonly databases = signal<Map<string, DatabaseMeta[]>>(new Map());
  readonly activeCollection = signal<string | null>(null);
  readonly collectionStats = signal<Map<string, CollectionStats>>(new Map());
  readonly columns = signal<Map<string, ColumnInfo[]>>(new Map());
  readonly queryResults = signal<Map<string, RowData[]>>(new Map());
  readonly loadingState = signal<Record<string, boolean>>({});

  readonly allCollections = computed(() => {
    const map = this.collections();
    const result: CollectionMeta[] = [];
    for (const cols of map.values()) {
      result.push(...cols);
    }
    return result;
  });

  setConnections(connections: ConnectionSummary[]): void {
    this.connections.set(connections);
  }

  updateConnection(id: string, updates: Partial<ConnectionSummary>): void {
    this.connections.update((conns) => conns.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }

  removeConnection(id: string): void {
    this.connections.update((conns) => conns.filter((c) => c.id !== id));
  }

  setCollections(connectionId: string, collections: CollectionMeta[]): void {
    this.collections.update((map) => {
      const newMap = new Map(map);
      newMap.set(connectionId, collections);
      return newMap;
    });
  }

  getCollections(connectionId?: string): CollectionMeta[] {
    if (connectionId) {
      return this.collections().get(connectionId) ?? [];
    }
    return this.allCollections();
  }

  setDatabases(connectionId: string, databases: DatabaseMeta[]): void {
    this.databases.update((map) => {
      const newMap = new Map(map);
      newMap.set(connectionId, databases);
      return newMap;
    });
  }

  getDatabases(connectionId: string): DatabaseMeta[] {
    return this.databases().get(connectionId) ?? [];
  }

  setCollectionStats(collectionName: string, stats: CollectionStats): void {
    this.collectionStats.update((map) => {
      const newMap = new Map(map);
      newMap.set(collectionName, stats);
      return newMap;
    });
  }

  getCollectionStats(collectionName: string): CollectionStats | undefined {
    return this.collectionStats().get(collectionName);
  }

  setColumns(collectionName: string, columns: ColumnInfo[]): void {
    this.columns.update((map) => {
      const newMap = new Map(map);
      newMap.set(collectionName, columns);
      return newMap;
    });
  }

  getColumns(collectionName: string): ColumnInfo[] {
    return this.columns().get(collectionName) ?? [];
  }

  setQueryResult(collectionName: string, data: RowData[]): void {
    this.queryResults.update((map) => {
      const newMap = new Map(map);
      newMap.set(collectionName, data);
      return newMap;
    });
  }

  getQueryResult(collectionName: string): RowData[] {
    return this.queryResults().get(collectionName) ?? [];
  }

  setLoading(key: string, loading: boolean): void {
    this.loadingState.update((state) => ({
      ...state,
      [key]: loading,
    }));
  }

  isLoading(key: string): boolean {
    return this.loadingState()[key] ?? false;
  }

  setActiveCollection(name: string | null): void {
    this.activeCollection.set(name);
  }

  clearAll(): void {
    this.connections.set([]);
    this.collections.set(new Map());
    this.databases.set(new Map());
    this.collectionStats.set(new Map());
    this.columns.set(new Map());
    this.queryResults.set(new Map());
    this.loadingState.set({});
    this.activeCollection.set(null);
  }
}
