import { Injectable, inject, signal, computed } from "@angular/core";
import {
  ConnectionSummary,
  ConnectionHealth,
  TestConnectionConfig,
} from "@entities/entities.connection.config";
import { DatabaseService } from "@services/services.database.service";
import { CACHE_CONSTANTS } from "@shared/utils/constants";
import { findById } from "@shared/utils/array.utils";
interface HealthCacheEntry {
  health: ConnectionHealth;
  timestamp: number;
}
@Injectable({ providedIn: "root" })
export class ConnectionCacheService {
  private db = inject(DatabaseService);
  private readonly page = "ConnectionCacheService";
  private readonly HEALTH_TTL_MS = CACHE_CONSTANTS.HEALTH_TTL_MS;
  private connectionsSignal = signal<ConnectionSummary[]>([]);
  private healthCacheSignal = signal<Map<string, HealthCacheEntry>>(new Map());
  readonly connections = this.connectionsSignal.asReadonly();
  readonly healthStatus = computed(() => {
    const map = this.healthCacheSignal();
    const result: Record<string, ConnectionHealth> = {};
    for (const [id, entry] of map.entries()) {
      if (Date.now() - entry.timestamp <= this.HEALTH_TTL_MS) {
        result[id] = entry.health;
      }
    }
    return result;
  });
  getConnections(): ConnectionSummary[] {
    return this.connectionsSignal();
  }
  getConnection(id: string): ConnectionSummary | undefined {
    return findById(this.connectionsSignal(), id);
  }
  updateConnections(connections: ConnectionSummary[]): void {
    this.connectionsSignal.set(connections);
  }
  removeConnection(id: string): void {
    this.connectionsSignal.update((conns) => conns.filter((c) => c.id !== id));
  }
  updateConnectionInCache(id: string, updates: Partial<ConnectionSummary>): void {
    this.connectionsSignal.update((conns) =>
      conns.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }
  async updateConnection(id: string, config: TestConnectionConfig): Promise<void> {
    try {
      await this.db.updateConnection(id, config);
      await this.refreshConnections();
    } catch (err) {
      throw err;
    }
  }
  getHealth(connectionId: string): ConnectionHealth | null {
    const cached = this.healthCacheSignal().get(connectionId);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.HEALTH_TTL_MS) {
      this.invalidateHealth(connectionId);
      return null;
    }
    return cached.health;
  }
  updateHealth(connectionId: string, health: ConnectionHealth): void {
    this.healthCacheSignal.update((map) => {
      const newMap = new Map(map);
      newMap.set(connectionId, { health, timestamp: Date.now() });
      return newMap;
    });
  }
  async checkHealth(connectionId: string): Promise<ConnectionHealth> {
    try {
      const cached = this.getHealth(connectionId);
      if (cached) {
        return cached;
      }
      const health = await this.db.testConnectionById(connectionId);
      const result = health ?? {
        healthy: false,
        provider: "unknown",
        latency_ms: 0,
        message: "Connection test failed",
      };
      this.updateHealth(connectionId, result);
      return result;
    } catch (err) {
      throw err;
    }
  }
  invalidateHealth(connectionId: string): void {
    this.healthCacheSignal.update((map) => {
      const newMap = new Map(map);
      newMap.delete(connectionId);
      return newMap;
    });
  }
  invalidateConnections(): void {
    this.connectionsSignal.set([]);
  }
  async refreshHealth(connectionId: string): Promise<ConnectionHealth> {
    this.invalidateHealth(connectionId);
    return this.checkHealth(connectionId);
  }
  async ensureConnectionsLoaded(): Promise<ConnectionSummary[]> {
    const cached = this.connectionsSignal();
    if (cached.length > 0) return cached;
    return this.refreshConnections();
  }
  async ensureHealthLoaded(connectionId: string): Promise<ConnectionHealth> {
    return this.checkHealth(connectionId);
  }
  async refreshConnections(): Promise<ConnectionSummary[]> {
    try {
      const connections = await this.db.listConnections();
      this.connectionsSignal.set(connections);
      return connections;
    } catch (err) {
      throw err;
    }
  }
  async testConnection(config: TestConnectionConfig): Promise<ConnectionHealth> {
    return this.db.testConnection(config);
  }
  async saveConnection(config: TestConnectionConfig): Promise<string> {
    try {
      const result = await this.db.saveConnection(config);
      await this.refreshConnections();
      return result;
    } catch (err) {
      throw err;
    }
  }
  async deleteConnection(id: string): Promise<void> {
    try {
      await this.db.deleteConnection(id);
      this.removeConnection(id);
    } catch (err) {
      throw err;
    }
  }
  async getFullConnection(
    id: string
  ): Promise<import("@entities/entities.connection.config").ConnectionConfigResult> {
    return this.db.getConnection(id);
  }
  async testConnectionById(connId: string): Promise<ConnectionHealth | null> {
    try {
      const result = await this.db.testConnectionById(connId);
      return result;
    } catch (err) {
      throw err;
    }
  }
  async testConnectionStatus(connId: string): Promise<ConnectionSummary | null> {
    try {
      const result = await this.db.testConnectionStatus(connId);
      return result;
    } catch (err) {
      throw err;
    }
  }
}
