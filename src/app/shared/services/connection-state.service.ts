import { Injectable, signal } from "@angular/core";
import { ConnectionSummary } from "../models/connection.config";

@Injectable({ providedIn: "root" })
export class ConnectionStateService {
  activeConnectionId = signal<string | null>(null);
  activeConnectionName = signal<string | null>(null);
  activeProvider = signal<string | null>(null);

  setActiveConnection(conn: ConnectionSummary) {
    this.activeConnectionId.set(conn.id);
    this.activeConnectionName.set(conn.name);
    this.activeProvider.set(conn.provider);
  }
}
