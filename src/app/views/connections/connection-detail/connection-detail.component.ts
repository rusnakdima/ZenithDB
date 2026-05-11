import { Component, inject, signal, OnInit, OnDestroy } from "@angular/core";
import { Router, RouterLink, ActivatedRoute } from "@angular/router";
import { TitleCasePipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { FormsModule } from "@angular/forms";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ConnectionHealthService } from "@shared/services/connection-health.service";
import { ConfirmService } from "@shared/services/confirm.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { ToastService } from "@services/toast.service";
import { ProviderUtils } from "@shared/utils/provider.utils";
import {
  ConnectionHealth,
  CollectionMeta,
  ConnectionSummary,
  ConnectionConfig,
} from "@shared/models/connection.config";
import { StatusBadgeComponent } from "@shared/components/status-badge/status-badge.component";
import { ConnectionStatusBadgeComponent } from "@shared/components/connection-status-badge/connection-status-badge.component";
import { withErrorHandling } from "@shared/utils/error-handler.utils";
import { Subscription } from "rxjs";

interface DbNode {
  name: string;
  expanded: boolean;
  collections: CollectionMeta[];
}

@Component({
  selector: "app-connection-detail",
  standalone: true,
  imports: [RouterLink, ConnectionStatusBadgeComponent, TitleCasePipe, MatIconModule, FormsModule],
  templateUrl: "./connection-detail.component.html",
})
export class ConnectionDetailComponent implements OnInit, OnDestroy {
  private db = inject(DatabaseService);
  private connState = inject(ConnectionStateService);
  private connHealth = inject(ConnectionHealthService);
  private confirm = inject(ConfirmService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  providerUtils = inject(ProviderUtils);
  route = inject(ActivatedRoute);
  router = inject(Router);

  connectionId = signal<string | null>(null);
  connectionName = signal<string | null>(null);
  provider = signal<string | null>(null);
  serverVersion = signal<string | null>(null);
  health = signal<ConnectionHealth | null>(null);
  collections = signal<CollectionMeta[]>([]);
  databases = signal<DbNode[]>([]);
  loading = signal(true);
  testing = signal(false);
  fullConfig = signal<any>(null);
  showCreateDb = signal(false);
  newDbName = "";
  creatingDb = signal(false);
  manuallyAddedDatabases = signal<string[]>([]);

  providerIcon = signal("dns");

  private routeSub: Subscription | null = null;

  async ngOnInit() {
    this.routeSub = this.route.paramMap.subscribe(async (params) => {
      const id = params.get("id");
      if (id && id !== "new") {
        this.connectionId.set(id);
        const connections = await this.db.listConnections();
        const conn = connections.find((c) => c.id === id);
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
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
  }

  private updateProviderIcon() {
    this.providerIcon.set(this.providerUtils.getProviderIcon(this.provider() || ""));
  }

  async loadConnectionDetails() {
    const connId = this.connectionId();
    if (!connId) return;

    const result = await withErrorHandling(
      async () => {
        const [version, collections, healthResult] = await Promise.all([
          this.db.getServerVersion().catch(() => null),
          this.db.listCollections().catch(() => []),
          this.connHealth.checkHealth(connId).catch(() => null),
        ]);
        return { version, collections, healthResult };
      },
      { loading: this.loading, context: "ConnectionDetails" },
      { errorHandler: this.errorHandler, toastService: this.toast }
    );

    if (result.success && result.data) {
      this.serverVersion.set(result.data.version);
      this.collections.set(result.data.collections);
      this.health.set(result.data.healthResult);
    }
  }

  async testConnection() {
    const fullConfig = this.fullConfig();
    if (!fullConfig) return;

    const connId = this.connectionId();
    if (connId) {
      this.connHealth.invalidateHealth(connId);
    }

    const config = {
      name: fullConfig.config.name,
      config: fullConfig.config.config,
    };

    const result = await withErrorHandling(
      async () => await this.db.testConnection(config),
      { loading: this.testing, context: "TestConnection" },
      { errorHandler: this.errorHandler, toastService: this.toast }
    );

    if (result.success && result.data) {
      this.health.set(result.data);
    }
  }

  async refresh() {
    await this.loadConnectionDetails();
  }

  async deleteConnection() {
    if (!this.connectionId()) return;
    if (await this.confirm.confirmDelete(this.connectionName()!)) {
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

  get connectionStatus(): "connected" | "disconnected" | undefined {
    return this.health()?.healthy ? "connected" : "disconnected";
  }

  openCollection(collectionName: string) {
    const connId = this.connectionId();
    if (connId) {
      this.router.navigate(["/connections", connId, "explorer"], {
        queryParams: { collection: collectionName },
      });
    }
  }

  openDatabase(dbName: string) {
    const connId = this.connectionId();
    if (connId) {
      this.router.navigate(["/connections", connId, "databases", dbName]);
    }
  }

  getCollectionsForDb(dbName: string): CollectionMeta[] {
    return this.collections().filter(
      (c) => c.name.startsWith(dbName + ".") || c.name.split(".")[0] === dbName || c.name === dbName
    );
  }

  getDbList(): string[] {
    const manuallyAdded = this.manuallyAddedDatabases();
    if (manuallyAdded.length > 0) {
      return manuallyAdded;
    }

    const colls = this.collections();
    const selectedDbs = this.getSelectedDatabases();
    if (selectedDbs.length > 0) {
      const hasDottedCollections = colls.some((c) => c.name.includes("."));
      if (!hasDottedCollections) {
        return selectedDbs;
      }
    }
    const dbs = new Set<string>(selectedDbs);
    colls.forEach((c) => {
      const parts = c.name.split(".");
      if (parts.length > 1) {
        dbs.add(parts[0]);
      } else if (selectedDbs.includes(c.name)) {
        dbs.add(c.name);
      } else {
        dbs.add("default");
      }
    });
    return Array.from(dbs);
  }

  getSelectedDatabases(): string[] {
    return this.manuallyAddedDatabases();
  }

  createDatabase() {
    if (!this.newDbName.trim()) return;
    this.manuallyAddedDatabases.update((dbs) => [...dbs, this.newDbName.trim()]);
    this.newDbName = "";
    this.showCreateDb.set(false);
  }

  startEditDb(dbName: string) {}

  saveEditDb() {}

  cancelEditDb() {}

  deleteDatabase(dbName: string) {}
}
