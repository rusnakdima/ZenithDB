import { Injectable, inject, signal } from "@angular/core";
import { ConnectionHealth } from "@shared/models/connection.config";
import { DatabaseService } from "./database.service";
import { TIME_CONSTANTS } from "@shared/utils/constants";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";

@Injectable({ providedIn: "root" })
export class ConnectionHealthService {
  private db = inject(DatabaseService);
  private logger = inject(DataflowLoggerService, { optional: true });
  private healthCache = signal<Map<string, { health: ConnectionHealth; timestamp: number }>>(
    new Map()
  );
  private readonly CACHE_TTL_MS = TIME_CONSTANTS.THIRTY_SECONDS_MS;

  getCachedHealth(connectionId: string): ConnectionHealth | null {
    const cached = this.healthCache().get(connectionId);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) {
      this.invalidateHealth(connectionId);
      return null;
    }
    this.logger?.logApiCall("connectionHealth", "getCachedHealth", "health_cache_hit", {
      connectionId,
    });
    return cached.health;
  }

  async checkHealth(connectionId: string): Promise<ConnectionHealth> {
    const startTime = performance.now();
    const cached = this.getCachedHealth(connectionId);
    if (cached) return cached;

    this.logger?.logApiCall("connectionHealth", "checkHealth", "health_check", { connectionId });
    const health = await this.db.testConnectionById(connectionId);
    const result = health ?? {
      healthy: false,
      provider: "unknown",
      responseTime: 0,
      error: "Connection test failed",
      details: {},
    };

    this.healthCache.update((map) => {
      const newMap = new Map(map);
      newMap.set(connectionId, { health: result, timestamp: Date.now() });
      return newMap;
    });

    this.logger?.logDataReceive(
      "connectionHealth",
      "checkHealth",
      "health_check",
      { connectionId, healthy: result.healthy },
      performance.now() - startTime
    );
    return result;
  }

  invalidateHealth(connectionId: string): void {
    const startTime = performance.now();
    this.healthCache.update((map) => {
      const newMap = new Map(map);
      newMap.delete(connectionId);
      return newMap;
    });
    this.logger?.logUserAction("connectionHealth", "invalidateHealth", { connectionId });
  }
}
