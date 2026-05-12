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
  DecentralizationService,
  DatabaseMetadata,
} from "@shared/services/decentralization.service";
import {
  ConnectionHealth,
  CollectionMeta,
  ConnectionSummary,
  ConnectionConfig,
} from "@shared/models/connection.config";
import { StatusBadgeComponent } from "@shared/components/status-badge/status-badge.component";
import { ConnectionStatusBadgeComponent } from "@shared/components/connection-status-badge/connection-status-badge.component";
import { withErrorHandling } from "@shared/utils/error-handler.utils";
import { AddDatabasePathComponent } from "../add-database-path/add-database-path.component";
import { Subscription } from "rxjs";
import { distinctUntilChanged } from "rxjs/operators";

interface DbNode {
  id?: number;
  name: string;
  path?: string;
  expanded: boolean;
  collections: CollectionMeta[];
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
  private connHealth = inject(ConnectionHealthService);
  private confirm = inject(ConfirmService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private localDb = inject(DecentralizationService);
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
  showAddDbModal = signal(false);
  creatingDb = signal(false);
  editingDb = signal<string | null>(null);
  editDbName = "";
  private isLoadingDetails = false;

  providerIcon = signal("dns");

  private routeSub: Subscription | null = null;

  async ngOnInit() {
    try {
      await Promise.race([
        this.localDb.initStorage(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Init timeout")), 5000)),
      ]);
    } catch (e) {
      console.error("Failed to initialize storage:", e);
    }

    this.routeSub = this.route.paramMap
      .pipe(distinctUntilChanged((prev, curr) => prev.get("id") === curr.get("id")))
      .subscribe(async (params) => {
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
              this.errorHandler.handleError(e, "Loading full config");
            }

            await this.loadConnectionDetails();
          }
        } else {
          this.connectionId.set(this.connState.activeConnectionId());
          this.connectionName.set(this.connState.activeConnectionName());
          this.provider.set(this.connState.activeProvider());
          this.fullConfig.set(this.connState.activeConnectionConfig());
        }
      });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.isLoadingDetails = false;
    this.loading.set(false);
  }

  private updateProviderIcon() {
    this.providerIcon.set(this.providerUtils.getProviderIcon(this.provider() || ""));
  }

  async loadConnectionDetails() {
    const connId = this.connectionId();
    if (!connId || this.isLoadingDetails) return;

    this.isLoadingDetails = true;
    try {
      const result = await withErrorHandling(
        async () => {
          const [version, collections, healthResult, localDatabases] = await Promise.all([
            this.db.getServerVersion().catch(() => null),
            this.db.listCollections().catch(() => []),
            this.connHealth.checkHealth(connId).catch(() => null),
            this.localDb.listDatabases(connId).catch(() => []),
          ]);
          return { version, collections, healthResult, localDatabases };
        },
        { loading: this.loading, context: "ConnectionDetails" },
        { errorHandler: this.errorHandler, toastService: this.toast }
      );

      if (result.success && result.data) {
        this.serverVersion.set(result.data.version);
        this.collections.set(result.data.collections);
        this.health.set(result.data.healthResult);
        const databases: DbNode[] = result.data.localDatabases.map((db: DatabaseMetadata) => ({
          id: db.id,
          name: db.name,
          path: db.path || undefined,
          expanded: false,
          collections: [],
        }));
        this.databases.set(databases);
      }
    } finally {
      this.isLoadingDetails = false;
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
      (c) => c.name.startsWith(dbName + ".") || c.name.split(".")[0] === dbName
    );
  }

  needsPath(): boolean {
    const p = this.provider();
    return p === "sqlite" || p === "json";
  }

  async onAddDbModalAdded(data: { name: string; path: string }) {
    const connId = this.connectionId();
    if (!connId) return;

    this.creatingDb.set(true);
    try {
      await this.localDb.saveDatabase(connId, data.name, data.path || undefined);
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
      const localDbs = await this.localDb.listDatabases(connId);
      const dbToEdit = localDbs.find((d) => d.name === oldName);
      if (dbToEdit) {
        await this.localDb.deleteDatabase(dbToEdit.id);
        await this.localDb.saveDatabase(connId, newName, dbToEdit.path || undefined);
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
      const localDbs = await this.localDb.listDatabases(connId);
      const dbToDelete = localDbs.find((d) => d.name === dbName);
      if (dbToDelete) {
        await this.localDb.deleteDatabase(dbToDelete.id);
      }
      await this.loadConnectionDetails();
    } catch (e) {
      this.errorHandler.handleError(e, "Deleting database");
    }
  }
}
