import { Injectable, inject } from "@angular/core";
import { TauriBridgeService } from "@providers/tauri-bridge.service";

export interface DatabaseMetadata {
  id: number;
  connection_id: string;
  name: string;
  path: string | null;
  created_at: number;
  updated_at: number;
  metadata: string | null;
}

@Injectable({ providedIn: "root" })
export class DecentralizationService {
  private tauriBridge = inject(TauriBridgeService);

  async initStorage(): Promise<void> {
    await this.tauriBridge.invoke("init_decentralized_storage");
  }

  async saveDatabase(
    connectionId: string,
    name: string,
    path?: string,
    metadata?: object
  ): Promise<DatabaseMetadata> {
    return this.tauriBridge.invoke<DatabaseMetadata>("save_database_metadata", {
      connectionId,
      name,
      path: path || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  }

  async listDatabases(connectionId: string): Promise<DatabaseMetadata[]> {
    return this.tauriBridge.invoke<DatabaseMetadata[]>("list_databases_metadata", {
      connectionId,
    });
  }

  async getDatabase(id: number): Promise<DatabaseMetadata | null> {
    return this.tauriBridge.invoke<DatabaseMetadata | null>("get_database_metadata", {
      id,
    });
  }

  async updateDatabase(
    id: number,
    name: string,
    path?: string,
    metadata?: object
  ): Promise<DatabaseMetadata> {
    return this.tauriBridge.invoke<DatabaseMetadata>("update_database_metadata", {
      id,
      name,
      path: path || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  }

  async deleteDatabase(id: number): Promise<void> {
    return this.tauriBridge.invoke<void>("delete_database_metadata", {
      id,
    });
  }

  async deleteConnectionDatabases(connectionId: string): Promise<void> {
    return this.tauriBridge.invoke<void>("delete_connection_databases_metadata", {
      connectionId,
    });
  }
}
