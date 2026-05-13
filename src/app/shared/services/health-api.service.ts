import { Injectable, inject, signal } from "@angular/core";
import { CacheService } from "@shared/services/cache.service";
import { TauriBridgeService } from "@providers/tauri-bridge.service";
import { ConnectionHealth } from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class HealthApiService extends CacheService {
  private tauriBridge = inject(TauriBridgeService);
  private healthSignal = signal<Map<string, ConnectionHealth>>(new Map());
  private healthTimestamps = signal<Map<string, number>>(new Map());
  private refreshCallbacks = new Map<string, Set<() => void>>();
  private readonly HEALTH_TTL_MS = 30 * 1000;

  getHealth(connectionId: string): ConnectionHealth | null {
    return this.healthSignal().get(connectionId) ?? null;
  }

  async checkHealth(connectionId: string): Promise<ConnectionHealth> {
    const cached = this.getHealth(connectionId);
    const timestamp = this.healthTimestamps().get(connectionId) ?? 0;
    if (cached && !this.isStale(timestamp, this.HEALTH_TTL_MS)) {
      return cached;
    }
    return this.fetchHealth(connectionId);
  }

  async checkHealthWithRefresh(connectionId: string): Promise<ConnectionHealth> {
    const result = await this.fetchHealth(connectionId);
    this.notifyRefresh(connectionId);
    return result;
  }

  onHealthRefreshed(connectionId: string, callback: () => void): () => void {
    if (!this.refreshCallbacks.has(connectionId)) {
      this.refreshCallbacks.set(connectionId, new Set());
    }
    this.refreshCallbacks.get(connectionId)!.add(callback);
    return () => this.refreshCallbacks.get(connectionId)?.delete(callback);
  }

  invalidateHealth(connectionId?: string): void {
    if (connectionId) {
      this.healthSignal.update((map) => {
        const newMap = new Map(map);
        newMap.delete(connectionId);
        return newMap;
      });
      this.healthTimestamps.update((map) => {
        const newMap = new Map(map);
        newMap.delete(connectionId);
        return newMap;
      });
    } else {
      this.healthSignal.set(new Map());
      this.healthTimestamps.set(new Map());
    }
  }

  private getHealthTimestamp(connectionId: string): number {
    return this.healthTimestamps().get(connectionId) ?? 0;
  }

  private async fetchHealth(connectionId: string): Promise<ConnectionHealth> {
    const cacheKey = `health:${connectionId}`;
    const fetchFn = async (): Promise<ConnectionHealth> => {
      const health = await this.tauriBridge.invoke<ConnectionHealth>("check_health", {
        connection_id: connectionId,
      });
      this.healthSignal.update((map) => {
        const newMap = new Map(map);
        newMap.set(connectionId, health);
        return newMap;
      });
      this.healthTimestamps.update((map) => {
        const newMap = new Map(map);
        newMap.set(connectionId, Date.now());
        return newMap;
      });
      return health;
    };
    return this.getOrFetch(cacheKey, fetchFn, this.HEALTH_TTL_MS);
  }

  private notifyRefresh(connectionId: string): void {
    this.refreshCallbacks.get(connectionId)?.forEach((cb) => cb());
  }
}
