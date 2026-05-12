import { Injectable, signal } from "@angular/core";
import { ConnectionSummary, ConnectionConfig } from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class ConnectionStateService {
  activeConnectionId = signal<string | null>(null);
  activeConnectionName = signal<string | null>(null);
  activeProvider = signal<string | null>(null);
  activeConnection = signal<ConnectionSummary | null>(null);
  activeConnectionConfig = signal<ConnectionConfig | null>(null);
  readOnly = signal(true);

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
}
