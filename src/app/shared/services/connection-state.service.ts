import { Injectable, signal, inject } from "@angular/core";
import { LoggingService } from "@shared/services/logging.service";
import { ConnectionSummary, ConnectionConfig } from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class ConnectionStateService {
  private logger = inject(LoggingService);
  activeConnectionId = signal<string | null>(null);
  activeConnectionName = signal<string | null>(null);
  activeProvider = signal<string | null>(null);
  activeConnection = signal<ConnectionSummary | null>(null);
  activeConnectionConfig = signal<ConnectionConfig | null>(null);
  readOnly = signal(true);

  activeDatabaseName = signal<string | null>(null);
  activeCollectionName = signal<string | null>(null);

  setActiveConnection(connOrId: ConnectionSummary | string): void {
    this.logger.debug("[CONNECTION_STATE]", "setActiveConnection called", {
      type: typeof connOrId,
    });
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
    this.logger.debug("[CONNECTION_STATE]", "setActiveConnectionConfig called");
    this.activeConnectionConfig.set(config);
  }

  setActiveDatabase(dbName: string | null): void {
    this.logger.debug("[CONNECTION_STATE]", "setActiveDatabase called", { dbName });
    this.activeDatabaseName.set(dbName);
  }

  setActiveCollection(collectionName: string | null): void {
    this.logger.debug("[CONNECTION_STATE]", "setActiveCollection called", { collectionName });
    this.activeCollectionName.set(collectionName);
  }
}
