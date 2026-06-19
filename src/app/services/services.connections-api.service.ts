import { Injectable, inject, signal, Injector } from "@angular/core";
import { CacheService } from "@shared/services/cache.service";
import { TauriBridgeService } from "@providers/tauri-bridge.service";
import { DataStoreService } from "@core/services/unified-storage.service";
import { ConnectionSummary } from "@entities/entities.connection.config";
@Injectable({ providedIn: "root" })
export class ConnectionsApiService extends CacheService {
  private connectionsSignal = signal<ConnectionSummary[]>([]);
  private refreshCallbacks: Set<() => void> = new Set();
  private tauriBridge = inject(TauriBridgeService);
  private injector = inject(Injector);
  private readonly page = "ConnectionsApiService";
  private get dataStore(): DataStoreService {
    return this.injector.get(DataStoreService);
  }
  getConnections(): ConnectionSummary[] {
    return this.connectionsSignal();
  }
  async listConnections(): Promise<ConnectionSummary[]> {
    const cached = this.connectionsSignal();
    if (cached.length > 0) return cached;
    return this.fetchConnections();
  }
  async listConnectionsWithRefresh(): Promise<ConnectionSummary[]> {
    try {
      const result = await this.fetchConnections();
      this.notifyRefresh();
      const duration = performance.now() - startTime;
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      throw err;
    }
  }
  onConnectionsRefreshed(callback: () => void): () => void {
    this.refreshCallbacks.add(callback);
    return () => this.refreshCallbacks.delete(callback);
  }
  invalidateConnections(): void {
    this.connectionsSignal.set([]);
    this.dataStore.invalidateConnections();
  }
  private async fetchConnections(): Promise<ConnectionSummary[]> {
    const cacheKey = "connections:all";
    return this.getOrFetch(cacheKey, () =>
      this.tauriBridge.invoke<ConnectionSummary[]>("list_connections").then((result) => {
        this.connectionsSignal.set(result);
        this.dataStore.updateConnections(result);
        return result;
      })
    );
  }
  private notifyRefresh(): void {
    this.refreshCallbacks.forEach((cb) => cb());
  }
}
