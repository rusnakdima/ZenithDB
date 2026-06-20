import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { TitleCasePipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { FormsModule } from "@angular/forms";
import { DataStoreService } from "@core/services/unified-storage.service";
import { ConnectionStateService } from "@services/services.connection-state.service";
import { ConfirmService } from "@shared/services/confirm.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { ToastService } from "@services/services.toast.service";
import { ProviderUtils } from "@shared/utils/provider.utils";
import { CollectionMeta } from "@entities/entities.connection.config";
import { withErrorHandling } from "@shared/utils/error-handler.utils";
import { QUERY_CONSTANTS } from "@shared/utils/constants";
import { AddDatabasePathComponent } from "../add-database-path/add-database-path.component";
import { Subscription } from "rxjs";
import { filter, distinctUntilChanged } from "rxjs/operators";
import { StatsCardComponent } from "@shared/components/stats-card/stats-card.component";
import { EmptyStateComponent } from "@shared/components/empty-state/empty-state.component";
@Component({
  selector: "app-database-detail",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconModule,
    FormsModule,
    AddDatabasePathComponent,
    StatsCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: "./database-detail.component.html",
})
export class DatabaseDetailComponent implements OnInit, OnDestroy {
  private store = inject(DataStoreService);
  private connState = inject(ConnectionStateService);
  private confirm = inject(ConfirmService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  providerUtils = inject(ProviderUtils);
  route = inject(ActivatedRoute);
  router = inject(Router);
  private readonly page = "DatabaseDetail";
  connectionId = signal<string | null>(null);
  connectionName = signal<string | null>(null);
  databaseName = signal<string | null>(null);
  provider = signal<string | null>(null);
  collections = signal<CollectionMeta[]>([]);
  loading = signal(false);
  totalDocuments = signal(0);
  editingCollection = signal<string | null>(null);
  editCollectionName = "";
  showCreateCollection = signal(false);
  newCollectionName = "";
  showAddDbModal = signal(false);
  private routeSub: Subscription | null = null;
  async ngOnInit() {
    this.routeSub = this.route.paramMap
      .pipe(
        filter((params) => params.get("id") !== null),
        distinctUntilChanged(
          (prev, curr) =>
            prev.get("id") === curr.get("id") && prev.get("dbName") === curr.get("dbName")
        )
      )
      .subscribe(async (params) => {
        const id = params.get("id");
        const dbName = params.get("dbName");
        if (id) {
          this.connectionId.set(id);
          this.databaseName.set(dbName);
          this.connState.setActiveDatabase(dbName);
          this.cdr.markForCheck();
          try {
            const fullConfig = await this.store.getFullConnection(id);
            if (fullConfig?.config?.config) {
              const connConfig = fullConfig.config.config;
              this.connectionName.set(fullConfig.config.name);
              this.provider.set(connConfig.type);
              this.connState.setActiveConnection({
                id: fullConfig.id,
                name: fullConfig.config.name,
                provider: connConfig.type,
                status: "connected",
              });
            }
          } catch (e) {
            this.errorHandler.handleError(e, "Loading connection details");
          }
          await this.loadCollections();
        }
      });
  }
  ngOnDestroy() {
    this.routeSub?.unsubscribe();
  }
  getProviderIcon(): string {
    return this.providerUtils.getProviderIcon(this.provider() || "");
  }
  async loadCollections() {
    const connId = this.connectionId();
    const dbName = this.databaseName();
    if (!connId || !dbName || this.loading()) return;
    this.loading.set(true);
    const t0 = Date.now();
    try {
      const result = await withErrorHandling(
        async () => {
          const response = await this.store.listCollectionsPaginated(
            connId,
            dbName,
            0,
            QUERY_CONSTANTS.MAX_LIMIT
          );
          return {
            collections: response.collections,
            total: response.collections.reduce((sum, c) => sum + c.count, 0),
          };
        },
        { loading: this.loading, context: "LoadCollections" },
        { errorHandler: this.errorHandler, toastService: this.toast }
      );
      if (result.success && result.data) {
        this.collections.set(result.data.collections);
        this.totalDocuments.set(result.data.total);
        this.cdr.markForCheck();
      }
    } finally {
      this.loading.set(false);
    }
  }
  trackByCollection(index: number, col: CollectionMeta): string {
    return col.name || String(index);
  }
  openCollection(collectionName: string) {
    const connId = this.connectionId();
    const dbName = this.databaseName();
    if (connId && dbName) {
      this.connState.setActiveDatabase(dbName);
      this.router.navigate(["/connections", connId, dbName, "explorer"], {
        queryParams: { collection: collectionName },
      });
    }
  }
  refresh() {
    this.loadCollections();
  }
  goBack() {
    const connId = this.connectionId();
    if (connId) {
      this.router.navigate(["/connections", connId]);
    }
  }
  openCreateCollectionModal() {
    this.newCollectionName = "";
    this.showCreateCollection.set(true);
    this.cdr.markForCheck();
  }
  closeCreateCollectionModal() {
    this.showCreateCollection.set(false);
    this.newCollectionName = "";
    this.cdr.markForCheck();
  }
  async createCollection() {
    const name = this.newCollectionName.trim();
    if (!name) return;
    const connId = this.connectionId();
    if (!connId) return;
    try {
      await this.store.createCollection(name);
      this.closeCreateCollectionModal();
      await this.loadCollections();
    } catch (e) {
      this.errorHandler.handleError(e, "Creating collection");
    }
  }
  startEditCollection(colName: string) {
    this.editingCollection.set(colName);
    this.editCollectionName = colName;
    this.cdr.markForCheck();
  }
  async saveEditCollection() {
    const oldName = this.editingCollection();
    if (!oldName) return;
    const newName = this.editCollectionName.trim();
    if (!newName || newName === oldName) {
      this.cancelEditCollection();
      return;
    }
    const connId = this.connectionId();
    if (!connId) return;
    try {
      await this.store.renameCollection(connId, oldName, newName);
      this.cancelEditCollection();
      await this.loadCollections();
    } catch (e) {
      this.errorHandler.handleError(e, "Renaming collection");
      this.cancelEditCollection();
    }
  }
  cancelEditCollection() {
    this.editingCollection.set(null);
    this.editCollectionName = "";
    this.cdr.markForCheck();
  }
  async deleteCollection(colName: string) {
    if (!(await this.confirm.confirmDelete(colName))) return;
    const connId = this.connectionId();
    if (!connId) return;
    try {
      await this.store.dropCollection(colName);
      await this.loadCollections();
    } catch (e) {
      this.errorHandler.handleError(e, "Deleting collection");
    }
  }
  async onAddDbModalAdded(data: { name: string; path: string }) {
    const connId = this.connectionId();
    if (!connId) return;
    try {
      await this.store.saveDatabase(connId, data.name, data.path || undefined);
      this.showAddDbModal.set(false);
      this.cdr.markForCheck();
      this.goBack();
    } catch (e) {
      this.errorHandler.handleError(e, "Adding database");
    }
  }
  onAddDbModalCancelled() {
    this.showAddDbModal.set(false);
    this.cdr.markForCheck();
  }
}
