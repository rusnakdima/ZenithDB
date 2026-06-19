import { Injectable, inject, signal } from "@angular/core";
import { CacheService } from "@shared/services/cache.service";
import { TauriBridgeService } from "@providers/tauri-bridge.service";
import { DatabaseMetadata } from "@entities/entities.connection.config";
export interface DatabaseListResult {
  databases: DatabaseMetadata[];
  hasMore: boolean;
  totalCount: number;
}
@Injectable({ providedIn: "root" })
export class DecentralizationApiService extends CacheService {
  private databasesSignal = signal<Map<string, DatabaseMetadata[]>>(new Map());
  private refreshCallbacks = new Map<string, Set<() => void>>();
  private inFlightDatabases = new Map<string, Promise<DatabaseListResult>>();
  private tauri = inject(TauriBridgeService);
  private readonly page = "DecentralizationApiService";
  getDatabases(connectionId: string): DatabaseMetadata[] {
    return this.databasesSignal().get(connectionId) ?? [];
  }
  getDatabasesSignal(connectionId: string) {
    return this.databasesSignal;
  }
  async listDatabases(connectionId: string, offset = 0, limit = 10): Promise<DatabaseListResult> {
    const cacheKey = `${connectionId}:${offset}`;
    if (offset === 0) {
      const existing = this.inFlightDatabases.get(connectionId);
      if (existing) {
        return existing.catch(() => ({ databases: [], hasMore: false, totalCount: 0 }));
      }
      const promise = this.fetchDatabases(connectionId, offset, limit).finally(() => {
        this.inFlightDatabases.delete(connectionId);
      });
      this.inFlightDatabases.set(connectionId, promise);
      return promise;
    }
    const existing = this.inFlightDatabases.get(cacheKey);
    if (existing) {
      return existing.catch(() => ({ databases: [], hasMore: false, totalCount: 0 }));
    }
    const promise = this.fetchDatabases(connectionId, offset, limit).finally(() => {
      this.inFlightDatabases.delete(cacheKey);
    });
    this.inFlightDatabases.set(cacheKey, promise);
    return promise;
  }
  async listDatabasesWithRefresh(connectionId: string): Promise<DatabaseListResult> {
    try {
      const result = await this.fetchDatabases(connectionId, 0, 10);
      this.notifyRefresh(connectionId);
      const duration = performance.now() - startTime;
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      throw err;
    }
  }
  async saveDatabase(connId: string, name: string, path?: string): Promise<DatabaseMetadata> {
    try {
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
      await this.fetchDatabases(connId, 0, 10);
      this.notifyRefresh(connId);
      const duration = performance.now() - startTime;
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      throw err;
    }
  }
  async deleteDatabase(id: number): Promise<void> {
    try {
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
        await this.fetchDatabases(connId, 0, 10);
        this.notifyRefresh(connId);
      }
      const duration = performance.now() - startTime;
    } catch (err) {
      const duration = performance.now() - startTime;
      throw err;
    }
  }
  async updateDatabase(id: number, name: string, path?: string): Promise<DatabaseMetadata> {
    try {
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
      await this.fetchDatabases(connId, 0, 10);
      this.notifyRefresh(connId);
      const duration = performance.now() - startTime;
      return result;
    } catch (err) {
      const duration = performance.now() - startTime;
      throw err;
    }
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
  private async fetchDatabases(
    connectionId: string,
    offset: number,
    limit: number
  ): Promise<DatabaseListResult> {
    return this.tauri
      .invoke<{
        databases: DatabaseMetadata[];
        has_more: boolean;
        total_count: number;
      }>("database_list", { connId: connectionId, offset, limit })
      .then((result) => {
        this.databasesSignal.update((map) => {
          const newMap = new Map(map);
          const existing = newMap.get(connectionId) ?? [];
          if (offset === 0) {
            newMap.set(connectionId, result.databases);
          } else {
            newMap.set(connectionId, [...existing, ...result.databases]);
          }
          return newMap;
        });
        return {
          databases: result.databases,
          hasMore: result.has_more,
          totalCount: result.total_count,
        };
      });
  }
  private notifyRefresh(connectionId: string): void {
    this.refreshCallbacks.get(connectionId)?.forEach((cb) => cb());
  }
}
