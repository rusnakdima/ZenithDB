import { Component, inject, signal, OnInit, OnDestroy, effect } from "@angular/core";
import { Router, RouterLink, ActivatedRoute } from "@angular/router";
import { TitleCasePipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { FormsModule } from "@angular/forms";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ConfirmService } from "@shared/services/confirm.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { ToastService } from "@services/toast.service";
import { ProviderUtils } from "@shared/utils/provider.utils";
import { DecentralizationApiService } from "@shared/services/decentralization-api.service";
import { ConnectionsApiService } from "@shared/services/connections-api.service";
import { HealthApiService } from "@shared/services/health-api.service";
import {
  DatabaseMetadata,
  ConnectionHealth,
  ConnectionSummary,
  ConnectionConfig,
} from "@shared/models/connection.config";
import { StatusBadgeComponent } from "@shared/components/status-badge/status-badge.component";
import { ConnectionStatusBadgeComponent } from "@shared/components/connection-status-badge/connection-status-badge.component";
import { withErrorHandling } from "@shared/utils/error-handler.utils";
import { AddDatabasePathComponent } from "../add-database-path/add-database-path.component";
import { Subscription } from "rxjs";
import { distinctUntilChanged, debounceTime } from "rxjs/operators";

interface DbNode {
  id?: number;
  name: string;
  path?: string;
}

@Component({
  selector: "app-connection-detail",
  standalone: true,
  imports: [
    RouterLink,
    ConnectionStatusBadgeComponent,
    TitleCasePipe,
    MatIconModule,
    FormsModule,
    AddDatabasePathComponent,
  ],
  templateUrl: "./connection-detail.component.html",
})
export class ConnectionDetailComponent implements OnInit, OnDestroy {
  private db = inject(DatabaseService);
  private connState = inject(ConnectionStateService);
  private connectionsApi = inject(ConnectionsApiService);
  private decentralizationApi = inject(DecentralizationApiService);
  private healthApi = inject(HealthApiService);
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
  databases = signal<DbNode[]>([]);
  loading = signal(true);
  testing = signal(false);
  fullConfig = signal<any>(null);
  showAddDbModal = signal(false);
  creatingDb = signal(false);
  editingDb = signal<string | null>(null);
  editDbName = "";
  isLoadingDetails = signal(false);
  databaseOffset = signal(0);
  databaseHasMore = signal(false);
  databaseTotalCount = signal(0);

  providerIcon = signal("dns");

  private routeSub: Subscription | null = null;
  private loadController: AbortController | null = null;

  private databasesEffect = effect(() => {
    const connId = this.connectionId();
    if (connId) {
      const cached = this.decentralizationApi.getDatabases(connId);
      if (cached.length > 0) {
        this.databases.set(
          cached.map((db: DatabaseMetadata) => ({
            id: db.id,
            name: db.name,
            path: db.path || undefined,
          }))
        );
      }
    }
  });

  async ngOnInit() {
    console.log("[ConnectionDetail] ngOnInit started, id:", this.connectionId());
    this.routeSub = this.route.paramMap
      .pipe(
        debounceTime(300),
        distinctUntilChanged((prev, curr) => prev.get("id") === curr.get("id"))
      )
      .subscribe(async (params) => {
        const id = params.get("id");
        console.log("[ConnectionDetail] route params received, id:", id);
        if (id && id !== "new") {
          this.connectionId.set(id);
          console.log("[ConnectionDetail] connectionId set to:", id);
          const connections = this.connectionsApi.getConnections();
          console.log("[ConnectionDetail] got connections, count:", connections.length);
          const conn = connections.find((c) => c.id === id);
          console.log("[ConnectionDetail] found conn:", conn?.name);
          if (conn) {
            this.connectionName.set(conn.name);
            this.provider.set(conn.provider);
            this.connState.setActiveConnection(conn);
            console.log("[ConnectionDetail] state set, loading connection details");
            await this.loadConnectionDetails();
          }
        } else {
          this.connectionId.set(this.connState.activeConnectionId());
          this.connectionName.set(this.connState.activeConnectionName());
          this.provider.set(this.connState.activeProvider());
          this.fullConfig.set(this.connState.activeConnectionConfig());
        }
        console.log("[ConnectionDetail] ngOnInit complete");
      });
  }

  ngOnDestroy() {
    this.isLoadingDetails.set(false);
    this.loading.set(false);
    this.routeSub?.unsubscribe();
  }

  private updateProviderIcon() {
    this.providerIcon.set(this.providerUtils.getProviderIcon(this.provider() || ""));
  }

  async loadConnectionDetails() {
    const connId = this.connectionId();
    if (!connId) return;

    if (this.isLoadingDetails()) return;
    this.isLoadingDetails.set(true);

    try {
      const [version, healthResult] = await Promise.all([
        this.db.getServerVersion().catch(() => null),
        this.healthApi.checkHealth(connId).catch(() => null),
      ]);

      const cachedDatabases = this.decentralizationApi.getDatabases(connId);
      if (cachedDatabases.length === 0) {
        await this.decentralizationApi.listDatabases(connId, 0, 10);
      }
      const databasesResult = this.decentralizationApi.getDatabases(connId);

      this.databaseOffset.set(0);
      this.databaseHasMore.set(false);
      this.databaseTotalCount.set(databasesResult.length);
      this.databases.set(
        databasesResult.map((db: DatabaseMetadata) => ({
          id: db.id,
          name: db.name,
          path: db.path || undefined,
        }))
      );
      this.serverVersion.set(version);
      this.health.set(healthResult);
      this.loading.set(false);
    } finally {
      this.isLoadingDetails.set(false);
    }
  }

  async loadMoreDatabases() {
    const connId = this.connectionId();
    if (!connId || this.isLoadingDetails() || !this.databaseHasMore()) return;

    this.isLoadingDetails.set(true);
    try {
      const newOffset = this.databaseOffset() + 10;
      const result = await this.decentralizationApi.listDatabases(connId, newOffset, 10);
      this.databaseOffset.set(newOffset);
      this.databaseHasMore.set(result.hasMore);
      this.databaseTotalCount.set(result.totalCount);
      this.databases.update((dbs) => [
        ...dbs,
        ...result.databases.map((db: DatabaseMetadata) => ({
          id: db.id,
          name: db.name,
          path: db.path || undefined,
        })),
      ]);
    } catch (e) {
      this.errorHandler.handleError(e, "Loading more databases");
    } finally {
      this.isLoadingDetails.set(false);
    }
  }

  async testConnection() {
    const fullConfig = this.fullConfig();
    if (!fullConfig) return;

    const connId = this.connectionId();
    if (connId) {
      this.healthApi.invalidateHealth(connId);
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

  editConnection() {
    const connId = this.connectionId();
    if (connId) {
      this.router.navigate(["/connections", connId, "edit"]);
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

  openDatabase(dbName: string) {
    const connId = this.connectionId();
    if (connId) {
      this.router.navigate(["/connections", connId, "databases", dbName]);
    }
  }

  needsPath(): boolean {
    const p = this.provider();
    return p === "sqlite" || p === "json";
  }

  isSingleDatabaseProvider(): boolean {
    const p = this.provider();
    return p === "sqlite" || p === "json";
  }

  async onAddDbModalAdded(data: { name: string; path: string }) {
    const connId = this.connectionId();
    if (!connId) return;

    this.creatingDb.set(true);
    try {
      await this.decentralizationApi.saveDatabase(connId, data.name, data.path || undefined);
      this.showAddDbModal.set(false);
      await this.loadConnectionDetails();
    } catch (e) {
      this.errorHandler.handleError(e, "Adding database");
    } finally {
      this.creatingDb.set(false);
    }
  }

  onAddDbModalCancelled() {
    this.showAddDbModal.set(false);
  }

  startEditDb(dbName: string) {
    this.editingDb.set(dbName);
    this.editDbName = dbName;
  }

  async saveEditDb() {
    const oldName = this.editingDb();
    if (!oldName) return;

    const newName = this.editDbName.trim();
    if (!newName || newName === oldName) {
      this.cancelEditDb();
      return;
    }

    const connId = this.connectionId();
    if (!connId) return;

    try {
      const localDbs = this.decentralizationApi.getDatabases(connId);
      const dbToEdit = localDbs.find((d) => d.name === oldName);
      if (dbToEdit) {
        await this.decentralizationApi.deleteDatabase(dbToEdit.id);
        await this.decentralizationApi.saveDatabase(connId, newName, dbToEdit.path || undefined);
      }
      this.cancelEditDb();
      await this.loadConnectionDetails();
    } catch (e) {
      this.errorHandler.handleError(e, "Renaming database");
      this.cancelEditDb();
    }
  }

  cancelEditDb() {
    this.editingDb.set(null);
    this.editDbName = "";
  }

  async deleteDatabase(dbName: string) {
    if (!(await this.confirm.confirmDelete(dbName))) return;

    const connId = this.connectionId();
    if (!connId) return;

    try {
      const localDbs = this.decentralizationApi.getDatabases(connId);
      const dbToDelete = localDbs.find((d) => d.name === dbName);
      if (dbToDelete) {
        await this.decentralizationApi.deleteDatabase(dbToDelete.id);
      }
      await this.loadConnectionDetails();
    } catch (e) {
      this.errorHandler.handleError(e, "Deleting database");
    }
  }
}
