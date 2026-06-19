import { Injectable, signal, inject } from "@angular/core";
import { ConnectionSummary, ConnectionConfig } from "@entities/entities.connection.config";

@Injectable({ providedIn: "root" })
export class ConnectionStateService {
  activeConnectionId = signal<string | null>(null);
  activeConnectionName = signal<string | null>(null);
  activeProvider = signal<string | null>(null);
  activeConnection = signal<ConnectionSummary | null>(null);
  activeConnectionConfig = signal<ConnectionConfig | null>(null);
  readOnly = signal(true);

  activeDatabaseName = signal<string | null>(null);
  activeCollectionName = signal<string | null>(null);

  setActiveConnection(connOrId: ConnectionSummary | string): void {
    if (typeof connOrId === "string") {
      this.activeConnectionId.set(connOrId);
    } else {
      this.activeConnectionId.set(connOrId.id);
      this.activeConnectionName.set(connOrId.name);
      this.activeProvider.set(connOrId.provider);
      this.activeConnection.set(connOrId);
    }
  }

  setActiveConnectionConfig(config: ConnectionConfig) {
    this.activeConnectionConfig.set(config);
  }

  setActiveDatabase(dbName: string | null): void {
    this.activeDatabaseName.set(dbName);
  }

  setActiveCollection(collectionName: string | null): void {
    this.activeCollectionName.set(collectionName);
  }
}
