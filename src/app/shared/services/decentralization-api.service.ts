import { Injectable, inject, signal } from "@angular/core";
import { CacheService } from "@shared/services/cache.service";
import { TauriBridgeService } from "@providers/tauri-bridge.service";
import { DatabaseMetadata } from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class DecentralizationApiService extends CacheService {
  private databasesSignal = signal<Map<string, DatabaseMetadata[]>>(new Map());
  private refreshCallbacks = new Map<string, Set<() => void>>();
  private tauri = inject(TauriBridgeService);

  getDatabases(connectionId: string): DatabaseMetadata[] {
    return this.databasesSignal().get(connectionId) ?? [];
  }

  async listDatabases(connectionId: string): Promise<DatabaseMetadata[]> {
    const cached = this.getDatabases(connectionId);
    if (cached.length > 0) return cached;
    return this.fetchDatabases(connectionId);
  }

  async listDatabasesWithRefresh(connectionId: string): Promise<DatabaseMetadata[]> {
    const result = await this.fetchDatabases(connectionId);
    this.notifyRefresh(connectionId);
    return result;
  }

  async saveDatabase(connId: string, name: string, path?: string): Promise<DatabaseMetadata> {
    const optimistic = this.getDatabases(connId);
    const tempDb: DatabaseMetadata = {
      id: Date.now(),
      connection_id: connId,
      name,
      path: path ?? null,
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: null,
    };
    this.databasesSignal.update((map) => {
      const newMap = new Map(map);
      newMap.set(connId, [...optimistic, tempDb]);
      return newMap;
    });

    const result = await this.tauri.invoke<DatabaseMetadata>("save_database_metadata", {
      connectionId: connId,
      name,
      path: path || null,
      metadata: null,
    });
    await this.fetchDatabases(connId);
    this.notifyRefresh(connId);
    return result;
  }

  async deleteDatabase(id: number): Promise<void> {
    let connId = "";
    this.databasesSignal.update((map) => {
      for (const [cid, dbs] of map) {
        const idx = dbs.findIndex((d) => d.id === id);
        if (idx >= 0) {
          connId = cid;
          const updated = [...dbs];
          updated.splice(idx, 1);
          const newMap = new Map(map);
          newMap.set(cid, updated);
          return newMap;
        }
      }
      return map;
    });

    await this.tauri.invoke<void>("delete_database_metadata", { id });
    if (connId) {
      await this.fetchDatabases(connId);
      this.notifyRefresh(connId);
    }
  }

  async updateDatabase(id: number, name: string, path?: string): Promise<DatabaseMetadata> {
    this.databasesSignal.update((map) => {
      const newMap = new Map(map);
      for (const [connId, dbs] of newMap) {
        const idx = dbs.findIndex((d) => d.id === id);
        if (idx >= 0) {
          const updated = [...dbs];
          updated[idx] = { ...updated[idx], name, path: path ?? updated[idx].path };
          newMap.set(connId, updated);
          break;
        }
      }
      return newMap;
    });

    const result = await this.tauri.invoke<DatabaseMetadata>("update_database_metadata", {
      id,
      name,
      path: path || null,
      metadata: null,
    });
    const connId = result.connection_id;
    await this.fetchDatabases(connId);
    this.notifyRefresh(connId);
    return result;
  }

  onDatabasesRefreshed(connectionId: string, callback: () => void): () => void {
    if (!this.refreshCallbacks.has(connectionId)) {
      this.refreshCallbacks.set(connectionId, new Set());
    }
    this.refreshCallbacks.get(connectionId)!.add(callback);
    return () => this.refreshCallbacks.get(connectionId)?.delete(callback);
  }

  invalidateDatabases(connectionId: string): void {
    this.databasesSignal.update((map) => {
      const newMap = new Map(map);
      newMap.delete(connectionId);
      return newMap;
    });
  }

  private async fetchDatabases(connectionId: string): Promise<DatabaseMetadata[]> {
    const cacheKey = `databases:${connectionId}`;
    return this.getOrFetch(cacheKey, () =>
      this.tauri
        .invoke<DatabaseMetadata[]>("list_databases_metadata", { connectionId })
        .then((result) => {
          this.databasesSignal.update((map) => {
            const newMap = new Map(map);
            newMap.set(connectionId, result);
            return newMap;
          });
          return result;
        })
    );
  }

  private notifyRefresh(connectionId: string): void {
    this.refreshCallbacks.get(connectionId)?.forEach((cb) => cb());
  }
}
