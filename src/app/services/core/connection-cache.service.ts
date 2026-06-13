import { Injectable, inject, signal, computed } from "@angular/core";
import {
  ConnectionSummary,
  ConnectionHealth,
  TestConnectionConfig,
} from "@shared/models/connection.config";
import { DatabaseService } from "@shared/services/database.service";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { LoggingService } from "@shared/services/logging.service";
import { CACHE_CONSTANTS } from "@shared/utils/constants";
import { findById } from "@shared/utils/array.utils";

interface HealthCacheEntry {
  health: ConnectionHealth;
  timestamp: number;
}

@Injectable({ providedIn: "root" })
export class ConnectionCacheService {
  private db = inject(DatabaseService);
  private dataflowLogger = inject(DataflowLoggerService);
  private logger = inject(LoggingService);
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

  updateConnection(id: string, updates: Partial<ConnectionSummary>): void {
    this.connectionsSignal.update((conns) =>
      conns.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
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
    this.dataflowLogger.logApiCall(this.page, "checkHealth", "test_connection_by_id", {
      connectionId,
    });
    const startTime = performance.now();
    try {
      const cached = this.getHealth(connectionId);
      if (cached) {
        this.dataflowLogger.logDataReceive(
          this.page,
          "checkHealth",
          "test_connection_by_id",
          { cached: true },
          performance.now() - startTime
        );
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
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "checkHealth",
        "test_connection_by_id",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "checkHealth",
        "test_connection_by_id",
        String(err),
        duration
      );
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
    this.dataflowLogger.logApiCall(this.page, "refreshConnections", "list_connections", {});
    const startTime = performance.now();
    try {
      const connections = await this.db.listConnections();
      this.logger.debug("[CONNECTION_CACHE]", "refreshConnections got connections", {
        count: connections.length,
      });
      this.connectionsSignal.set(connections);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "refreshConnections",
        "list_connections",
        { count: connections.length },
        duration
      );
      return connections;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "refreshConnections",
        "list_connections",
        String(err),
        duration
      );
      throw err;
    }
  }

  async testConnection(config: TestConnectionConfig): Promise<ConnectionHealth> {
    return this.db.testConnection(config);
  }

  async saveConnection(config: TestConnectionConfig): Promise<string> {
    this.dataflowLogger.logApiCall(this.page, "saveConnection", "save_connection", { config });
    const startTime = performance.now();
    try {
      const result = await this.db.saveConnection(config);
      await this.refreshConnections();
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "saveConnection",
        "save_connection",
        { id: result },
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "saveConnection",
        "save_connection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async deleteConnection(id: string): Promise<void> {
    this.dataflowLogger.logApiCall(this.page, "deleteConnection", "delete_connection", { id });
    const startTime = performance.now();
    try {
      await this.db.deleteConnection(id);
      this.removeConnection(id);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "deleteConnection",
        "delete_connection",
        { success: true },
        duration
      );
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "deleteConnection",
        "delete_connection",
        String(err),
        duration
      );
      throw err;
    }
  }

  async getFullConnection(
    id: string
  ): Promise<import("@shared/models/connection.config").ConnectionConfigResult> {
    return this.db.getConnection(id);
  }

  async testConnectionById(connId: string): Promise<ConnectionHealth | null> {
    this.dataflowLogger.logApiCall(this.page, "testConnectionById", "test_connection_by_id", {
      connId,
    });
    const startTime = performance.now();
    try {
      const result = await this.db.testConnectionById(connId);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "testConnectionById",
        "test_connection_by_id",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "testConnectionById",
        "test_connection_by_id",
        String(err),
        duration
      );
      throw err;
    }
  }

  async testConnectionStatus(connId: string): Promise<ConnectionSummary | null> {
    this.dataflowLogger.logApiCall(this.page, "testConnectionStatus", "test_connection_status", {
      connId,
    });
    const startTime = performance.now();
    try {
      const result = await this.db.testConnectionStatus(connId);
      const duration = performance.now() - startTime;
      this.dataflowLogger.logDataReceive(
        this.page,
        "testConnectionStatus",
        "test_connection_status",
        result,
        duration
      );
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      this.dataflowLogger.logError(
        this.page,
        "testConnectionStatus",
        "test_connection_status",
        String(err),
        duration
      );
      throw err;
    }
  }
}
