import { Component, inject, signal, OnInit } from "@angular/core";
import { Router, RouterLink, ActivatedRoute } from "@angular/router";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ConnectionHealth } from "@shared/models/connection.config";

@Component({
  selector: "app-connection-detail",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./connection-detail.component.html",
})
export class ConnectionDetailComponent implements OnInit {
  private db = inject(DatabaseService);
  private connState = inject(ConnectionStateService);
  route = inject(ActivatedRoute);
  router = inject(Router);

  connectionId = signal<string | null>(null);
  connectionName = signal<string | null>(null);
  provider = signal<string | null>(null);
  serverVersion = signal<string | null>(null);
  health = signal<ConnectionHealth | null>(null);

  async ngOnInit() {
    this.connectionId.set(this.connState.activeConnectionId());
    this.connectionName.set(this.connState.activeConnectionName());
    this.provider.set(this.connState.activeProvider());

    if (this.connectionId()) {
      try {
        this.serverVersion.set(await this.db.getServerVersion());
        const healthResult = await this.db.testConnection({
          type: this.provider() as any,
          name: this.connectionName() || "",
          uri: "",
          path: "",
        } as any);
        this.health.set(healthResult);
      } catch (e) {
        console.error("Failed to load connection details", e);
      }
    }
  }

  disconnect() {
    this.connState.activeConnectionId.set(null);
    this.connState.activeConnectionName.set(null);
    this.connState.activeProvider.set(null);
    this.router.navigate(["/connections"]);
  }
}
