import { Injectable, inject, signal } from "@angular/core";
import { ConnectionHealth } from "@shared/models/connection.config";
import { DatabaseService } from "./database.service";

@Injectable({ providedIn: "root" })
export class ConnectionHealthService {
  private db = inject(DatabaseService);
  private healthCache = signal<Map<string, { health: ConnectionHealth; timestamp: number }>>(
    new Map()
  );
  private readonly CACHE_TTL_MS = 30000;

  getCachedHealth(connectionId: string): ConnectionHealth | null {
    const cached = this.healthCache().get(connectionId);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) {
      this.invalidateHealth(connectionId);
      return null;
    }
    return cached.health;
  }

  async checkHealth(connectionId: string): Promise<ConnectionHealth> {
    const cached = this.getCachedHealth(connectionId);
    if (cached) return cached;

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

    return result;
  }

  invalidateHealth(connectionId: string): void {
    this.healthCache.update((map) => {
      const newMap = new Map(map);
      newMap.delete(connectionId);
      return newMap;
    });
  }
}
