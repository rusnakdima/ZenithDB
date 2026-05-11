import { Component, inject, signal, OnInit, OnDestroy } from "@angular/core";
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
import { CollectionMeta } from "@shared/models/connection.config";
import { withErrorHandling } from "@shared/utils/error-handler.utils";
import { Subscription } from "rxjs";
import { filter, distinctUntilChanged } from "rxjs/operators";

@Component({
  selector: "app-database-detail",
  standalone: true,
  imports: [MatIconModule, TitleCasePipe, FormsModule],
  templateUrl: "./database-detail.component.html",
})
export class DatabaseDetailComponent implements OnInit, OnDestroy {
  private db = inject(DatabaseService);
  private connState = inject(ConnectionStateService);
  private confirm = inject(ConfirmService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  providerUtils = inject(ProviderUtils);
  route = inject(ActivatedRoute);
  router = inject(Router);

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

          try {
            const fullConfig = await this.db.getConnection(id);
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
            console.error("Failed to load connection:", e);
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
    if (!connId || !dbName) return;

    if (this.loading()) {
      return;
    }

    const result = await withErrorHandling(
      async () => {
        const collections = await this.db.listCollections(connId, dbName);
        const total = collections.reduce((sum, c) => sum + c.count, 0);
        return { collections, total };
      },
      { loading: this.loading, context: "LoadCollections" },
      { errorHandler: this.errorHandler, toastService: this.toast }
    );

    if (result.success && result.data) {
      this.collections.set(result.data.collections);
      this.totalDocuments.set(result.data.total);
    }
  }

  openCollection(collectionName: string) {
    const connId = this.connectionId();
    const dbName = this.databaseName();
    if (connId) {
      this.router.navigate(["/connections", connId, "explorer"], {
        queryParams: { collection: collectionName, db: dbName },
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
  }

  closeCreateCollectionModal() {
    this.showCreateCollection.set(false);
    this.newCollectionName = "";
  }

  async createCollection() {
    const name = this.newCollectionName.trim();
    if (!name) return;

    const connId = this.connectionId();
    if (!connId) return;

    try {
      await this.db.createCollection(name);
      this.closeCreateCollectionModal();
      await this.loadCollections();
    } catch (e) {
      console.error("Failed to create collection:", e);
    }
  }

  startEditCollection(colName: string) {
    this.editingCollection.set(colName);
    this.editCollectionName = colName;
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
      await this.db.renameCollection(connId, oldName, newName);
      this.cancelEditCollection();
      await this.loadCollections();
    } catch (e) {
      console.error("Failed to rename collection:", e);
      this.cancelEditCollection();
    }
  }

  cancelEditCollection() {
    this.editingCollection.set(null);
    this.editCollectionName = "";
  }

  async deleteCollection(colName: string) {
    if (!(await this.confirm.confirmDelete(colName))) return;

    const connId = this.connectionId();
    if (!connId) return;

    try {
      await this.db.dropCollection(colName);
      await this.loadCollections();
    } catch (e) {
      console.error("Failed to delete collection:", e);
    }
  }
}
