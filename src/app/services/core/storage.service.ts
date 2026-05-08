import { Injectable, signal } from "@angular/core";
import { BaseStorageService } from "./base-storage.service";
import { safeJsonParse } from "@shared/utils/json.utils";
import {
  ConnectionSummary,
  CollectionMeta,
  SystemMetrics,
} from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class StorageService extends BaseStorageService {
  private readonly connectionsSignal = signal<ConnectionSummary[]>([]);
  private readonly collectionsSignal = signal<CollectionMeta[]>([]);
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

  setSystemMetrics(metrics: SystemMetrics) {
    this.systemMetricsSignal.set(metrics);
  }

  getItem<T>(key: string): T | null {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return safeJsonParse(stored, null);
  }

  setItem<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
}
