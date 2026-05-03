import { Component, inject, signal, OnInit } from "@angular/core";
import { Router, RouterLink, ActivatedRoute } from "@angular/router";
import { TitleCasePipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ConnectionHealth, CollectionMeta, ConnectionSummary, ConnectionConfig } from "@shared/models/connection.config";
import { StatusBadgeComponent } from "@shared/components/status-badge/status-badge.component";

@Component({
  selector: "app-connection-detail",
  standalone: true,
  imports: [RouterLink, StatusBadgeComponent, TitleCasePipe, MatIconModule],
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
  collections = signal<CollectionMeta[]>([]);
  loading = signal(true);
  testing = signal(false);
  fullConfig = signal<any>(null);

  providerIcon = signal("dns");

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get("id");
    if (id && id !== "new") {
      this.connectionId.set(id);
      const connections = await this.db.listConnections();
      const conn = connections.find(c => c.id === id);
      if (conn) {
        this.connectionName.set(conn.name);
        this.provider.set(conn.provider);
        this.connState.setActiveConnection(conn);
        try {
          const fullConn = await this.db.getConnection(id);
          this.fullConfig.set(fullConn);
        } catch (e) {
          console.error("Failed to load full config:", e);
        }
      }
    } else {
      this.connectionId.set(this.connState.activeConnectionId());
      this.connectionName.set(this.connState.activeConnectionName());
      this.provider.set(this.connState.activeProvider());
      this.fullConfig.set(this.connState.activeConnectionConfig());
    }

    this.updateProviderIcon();
    await this.loadConnectionDetails();
  }

  private updateProviderIcon() {
    const p = this.provider()?.toLowerCase() || "";
    if (p.includes("mongo")) this.providerIcon.set("eco");
    else if (p.includes("postgres")) this.providerIcon.set("storage");
    else if (p.includes("redis")) this.providerIcon.set("flash_on");
    else if (p.includes("mysql")) this.providerIcon.set("storage");
    else if (p.includes("sqlite")) this.providerIcon.set("insert_drive_file");
    else if (p.includes("json")) this.providerIcon.set("description");
    else this.providerIcon.set("dns");
  }

  async loadConnectionDetails() {
    this.loading.set(true);
    try {
      if (this.connectionId()) {
        const config = this.fullConfig();
        const [version, collections, healthResult] = await Promise.all([
          this.db.getServerVersion().catch(() => null),
          this.db.listCollections().catch(() => []),
          config ? this.db.testConnection(config).catch(() => null) : Promise.resolve(null),
        ]);

        this.serverVersion.set(version);
        this.collections.set(collections);
        this.health.set(healthResult);
      }
    } catch (e) {
      console.error("Failed to load connection details", e);
    } finally {
      this.loading.set(false);
    }
  }

  async testConnection() {
    this.testing.set(true);
    try {
      const config = this.fullConfig();
      if (!config) {
        throw new Error("No connection config available");
      }
      const result = await this.db.testConnection(config);
      this.health.set(result);
    } catch (e) {
      console.error("Test connection failed:", e);
    } finally {
      this.testing.set(false);
    }
  }

  async refresh() {
    await this.loadConnectionDetails();
  }

  async deleteConnection() {
    if (!this.connectionId()) return;
    if (confirm(`Delete connection "${this.connectionName()}"? This action cannot be undone.`)) {
      await this.db.deleteConnection(this.connectionId()!);
      this.disconnect();
    }
  }

  disconnect() {
    this.connState.activeConnectionId.set(null);
    this.connState.activeConnectionName.set(null);
    this.connState.activeProvider.set(null);
    this.router.navigate(["/connections"]);
  }

  get connectionStatus(): "connected" | "offline" {
    return this.health()?.healthy ? "connected" : "offline";
  }
}