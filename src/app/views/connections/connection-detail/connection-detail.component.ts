import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { Router, RouterLink, ActivatedRoute } from "@angular/router";
import { TitleCasePipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { FormsModule } from "@angular/forms";
import { DataStoreService } from "@shared/services/core/unified-storage.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ConfirmService } from "@shared/services/confirm.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { ToastService } from "@services/toast.service";
import { ProviderUtils } from "@shared/utils/provider.utils";
import {
  DatabaseMetadata,
  ConnectionHealth,
  ConnectionSummary,
  ConnectionConfigResult,
} from "@shared/models/connection.config";
import { StatusBadgeComponent } from "@shared/components/status-badge/status-badge.component";
import { ConnectionStatusBadgeComponent } from "@shared/components/connection-status-badge/connection-status-badge.component";
import { withErrorHandling } from "@shared/utils/error-handler.utils";
import { findById } from "@shared/utils/array.utils";
import { AddDatabasePathComponent } from "../add-database-path/add-database-path.component";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { getLoggingService } from "@tauri-apps/logger";
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConnectionStatusBadgeComponent, MatIconModule, FormsModule, AddDatabasePathComponent],
  templateUrl: "./connection-detail.component.html",
})
export class ConnectionDetailComponent implements OnInit, OnDestroy {
  private store = inject(DataStoreService);
  private connState = inject(ConnectionStateService);
  private confirm = inject(ConfirmService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private dataflowLogger = inject(DataflowLoggerService);
  private logger = getLoggingService();
  providerUtils = inject(ProviderUtils);
  route = inject(ActivatedRoute);
  router = inject(Router);

  private readonly page = "ConnectionDetail";

  connectionId = signal<string | null>(null);
  connectionName = signal<string | null>(null);
  provider = signal<string | null>(null);
  serverVersion = signal<string | null>(null);
  health = signal<ConnectionHealth | null>(null);
  databases = signal<DbNode[]>([]);
  loading = signal(true);
  testing = signal(false);
  fullConfig = signal<ConnectionConfigResult | null>(null);
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
  private currentLoadId: string | null = null;

  async ngOnInit() {
    this.logger.debug("[CONNECTION_DETAIL]", "ngOnInit");
    this.routeSub = this.route.paramMap
      .pipe(
        debounceTime(300),
        distinctUntilChanged((prev, curr) => prev.get("id") === curr.get("id"))
      )
      .subscribe((params) => {
        this.handleRouteChange(params.get("id"));
      });
  }

  private async handleRouteChange(id: string | null): Promise<void> {
    this.logger.debug("[CONNECTION_DETAIL]", "handleRouteChange", { id });
    if (!id || id === "new") {
      this.connectionId.set(this.connState.activeConnectionId());
      this.connectionName.set(this.connState.activeConnectionName());
      this.provider.set(this.connState.activeProvider());
      return;
    }

    const loadId = id;
    if (this.currentLoadId === loadId && this.isLoadingDetails()) {
      return;
    }
    this.currentLoadId = loadId;

    this.connectionId.set(id);
    const connections = this.store.connections();
    const conn = findById(connections, id);
    if (conn) {
      this.connectionName.set(conn.name);
      this.provider.set(conn.provider);
      this.connState.setActiveConnection(conn);
    }

    if (loadId !== this.currentLoadId) return;

    await this.loadConnectionDetails();

    if (loadId !== this.currentLoadId) return;
  }

  ngOnDestroy() {
    this.isLoadingDetails.set(false);
    this.loading.set(false);
    this.routeSub?.unsubscribe();
    this.loadController?.abort();
    this.currentLoadId = null;
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
      this.loading.set(true);

      const [databasesResult, fullConfigResult] = await Promise.all([
        this.store.ensureDatabasesLoaded(connId),
        this.store.getFullConnection(connId).catch(() => null),
      ]);

      if (fullConfigResult) {
        this.fullConfig.set(fullConfigResult);
      }

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

      this.loadHealthAndVersion(connId);
    } finally {
      this.isLoadingDetails.set(false);
    }
  }

  private async loadHealthAndVersion(connId: string): Promise<void> {
    try {
      const [version, healthResult] = await Promise.all([
        this.store.getServerVersion().catch(() => null),
        this.store.ensureHealthLoaded(connId).catch(() => null),
      ]);

      this.serverVersion.set(version);
      this.health.set(healthResult);
      this.loading.set(false);
    } catch (e) {
      this.errorHandler.handleError(e, "loadHealthAndVersion");
      this.loading.set(false);
    }
  }

  async loadMoreDatabases() {
    const connId = this.connectionId();
    if (!connId || this.isLoadingDetails() || !this.databaseHasMore()) return;

    this.isLoadingDetails.set(true);
    try {
      const newOffset = this.databaseOffset() + 10;
      const result = await this.store.listDatabasesPaginated(connId, newOffset, 10);
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
    this.logger.log("[CONNECTION_DETAIL]", "User action: testConnection");
    const fullConfig = this.fullConfig();
    if (!fullConfig) return;

    const connId = this.connectionId();
    if (connId) {
      this.store.invalidateHealth(connId);
    }

    const config = {
      name: fullConfig.config.name,
      config: fullConfig.config.config,
    };

    const result = await withErrorHandling(
      async () => await this.store.testConnection(config),
      { loading: this.testing, context: "TestConnection" },
      { errorHandler: this.errorHandler, toastService: this.toast }
    );

    if (result.success && result.data) {
      this.health.set(result.data);
    }
  }

  async refresh() {
    this.logger.log("[CONNECTION_DETAIL]", "User action: refresh");
    await this.loadConnectionDetails();
  }

  async deleteConnection() {
    this.logger.log("[CONNECTION_DETAIL]", "User action: deleteConnection");
    if (!this.connectionId()) return;
    if (await this.confirm.confirmDelete(this.connectionName()!)) {
      await this.store.deleteConnection(this.connectionId()!);
      this.disconnect();
    }
  }

  editConnection() {
    this.logger.log("[CONNECTION_DETAIL]", "User action: editConnection");
    const connId = this.connectionId();
    if (connId) {
      this.router.navigate(["/connections", connId, "edit"]);
    }
  }

  disconnect() {
    this.logger.log("[CONNECTION_DETAIL]", "User action: disconnect");
    this.connState.activeConnectionId.set(null);
    this.connState.activeConnectionName.set(null);
    this.connState.activeProvider.set(null);
    this.router.navigate(["/connections"]);
  }

  get connectionStatus(): "connected" | "disconnected" | undefined {
    return this.health()?.healthy ? "connected" : "disconnected";
  }

  openDatabase(dbName: string) {
    this.logger.log("[CONNECTION_DETAIL]", "User action: openDatabase", { dbName });
    const connId = this.connectionId();
    if (connId) {
      this.router.navigate(["/connections", connId, dbName]);
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
    this.logger.log("[CONNECTION_DETAIL]", "User action: addDatabase", { name: data.name });
    const connId = this.connectionId();
    if (!connId) return;

    this.creatingDb.set(true);
    try {
      await this.store.saveDatabase(connId, data.name, data.path || undefined);
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

    this.logger.log("[CONNECTION_DETAIL]", "User action: renameDatabase", { oldName, newName });
    const connId = this.connectionId();
    if (!connId) return;

    try {
      const localDbs = this.store.getDatabases(connId);
      const dbToEdit = localDbs.find((d) => d.name === oldName);
      if (dbToEdit) {
        await this.store.deleteDatabase(dbToEdit.id);
        await this.store.saveDatabase(connId, newName, dbToEdit.path || undefined);
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
    this.logger.log("[CONNECTION_DETAIL]", "User action: deleteDatabase", { dbName });
    if (!(await this.confirm.confirmDelete(dbName))) return;

    const connId = this.connectionId();
    if (!connId) return;

    try {
      const localDbs = this.store.getDatabases(connId);
      const dbToDelete = localDbs.find((d) => d.name === dbName);
      if (dbToDelete) {
        await this.store.deleteDatabase(dbToDelete.id);
        await this.loadConnectionDetails();
      }
    } catch (e) {
      this.errorHandler.handleError(e, "Deleting database");
    }
  }
}
