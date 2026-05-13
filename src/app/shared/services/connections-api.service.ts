import { Injectable, inject, signal } from "@angular/core";
import { CacheService } from "@shared/services/cache.service";
import { TauriBridgeService } from "@providers/tauri-bridge.service";
import { ConnectionSummary } from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class ConnectionsApiService extends CacheService {
  private connectionsSignal = signal<ConnectionSummary[]>([]);
  private refreshCallbacks: Set<() => void> = new Set();
  private tauriBridge = inject(TauriBridgeService);

  getConnections(): ConnectionSummary[] {
    return this.connectionsSignal();
  }

  async listConnections(): Promise<ConnectionSummary[]> {
    const cached = this.connectionsSignal();
    if (cached.length > 0) return cached;
    return this.fetchConnections();
  }

  async listConnectionsWithRefresh(): Promise<ConnectionSummary[]> {
    const result = await this.fetchConnections();
    this.notifyRefresh();
    return result;
  }

  onConnectionsRefreshed(callback: () => void): () => void {
    this.refreshCallbacks.add(callback);
    return () => this.refreshCallbacks.delete(callback);
  }

  invalidateConnections(): void {
    this.connectionsSignal.set([]);
  }

  private async fetchConnections(): Promise<ConnectionSummary[]> {
    const cacheKey = "connections:all";
    return this.getOrFetch(cacheKey, () =>
      this.tauriBridge.invoke<ConnectionSummary[]>("list_connections").then((result) => {
        this.connectionsSignal.set(result);
        return result;
      })
    );
  }

  private notifyRefresh(): void {
    this.refreshCallbacks.forEach((cb) => cb());
  }
}
