import { Component, inject, OnInit, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { DatabaseService } from "../../../shared/services/database.service";
import { ConnectionStateService } from "../../../shared/services/connection-state.service";
import { ConnectionSummary } from "../../../shared/models/connection.config";

@Component({
  selector: "app-connection-list",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./connection-list.component.html",
})
export class ConnectionListComponent implements OnInit {
  connections: ConnectionSummary[] = [];
  private db = inject(DatabaseService);
  private connState = inject(ConnectionStateService);

  async ngOnInit() {
    this.connections = await this.db.listConnections();
  }

  async connect(conn: ConnectionSummary) {
    this.connState.activeConnectionId.set(conn.id);
    this.connState.activeConnectionName.set(conn.name);
    this.connState.activeProvider.set(conn.provider);
  }

  async delete(conn: ConnectionSummary) {
    if (confirm(`Delete connection "${conn.name}"?`)) {
      await this.db.deleteConnection(conn.id);
      this.connections = await this.db.listConnections();
    }
  }
}
