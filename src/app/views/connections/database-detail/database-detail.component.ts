import { Component, inject, signal, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, effect } from "@angular/core";
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
import { CollectionsApiService } from "@shared/services/collections-api.service";
import { HealthApiService } from "@shared/services/health-api.service";
import { CollectionMeta } from "@shared/models/connection.config";
import { withErrorHandling } from "@shared/utils/error-handler.utils";
import { AddDatabasePathComponent } from "../add-database-path/add-database-path.component";
import { Subscription } from "rxjs";
import { filter, distinctUntilChanged } from "rxjs/operators";

@Component({
  selector: "app-database-detail",
  standalone: true,
  imports: [MatIconModule, TitleCasePipe, FormsModule, AddDatabasePathComponent],
  templateUrl: "./database-detail.component.html",
})
export class DatabaseDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild("loadMoreTrigger") loadMoreTrigger?: ElementRef;

  private db = inject(DatabaseService);
  private connState = inject(ConnectionStateService);
  private confirm = inject(ConfirmService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  private decentralizationApi = inject(DecentralizationApiService);
  private collectionsApi = inject(CollectionsApiService);
  private healthApi = inject(HealthApiService);
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

  collectionOffset = signal(0);
  collectionHasMore = signal(false);
  collectionTotalCount = signal(0);
  loadingMore = signal(false);

  editingCollection = signal<string | null>(null);
  editCollectionName = "";
  showCreateCollection = signal(false);
  newCollectionName = "";
  showAddDbModal = signal(false);

  private routeSub: Subscription | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private isLoadingCollections = false;

  private collectionsEffect = effect(() => {
    const connId = this.connectionId();
    if (connId) {
      const cached = this.collectionsApi.getCollections(connId);
      if (cached.length > 0) {
        this.collections.set(cached);
      }
    }
  });

  ngAfterViewInit() {
    this.setupIntersectionObserver();
  }

  private setupIntersectionObserver() {
    if (!this.loadMoreTrigger) return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && this.collectionHasMore() && !this.loadingMore()) {
          this.loadMoreCollections();
        }
      },
      { threshold: 0.1 }
    );

    this.intersectionObserver.observe(this.loadMoreTrigger.nativeElement);
  }

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
            this.errorHandler.handleError(e, "Loading connection details");
          }

          await this.loadCollections();
        }
      });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.isLoadingCollections = false;
    this.intersectionObserver?.disconnect();
  }

  getProviderIcon(): string {
    return this.providerUtils.getProviderIcon(this.provider() || "");
  }

  async loadCollections() {
    const connId = this.connectionId();
    const dbName = this.databaseName();
    if (!connId || !dbName || this.isLoadingCollections) return;

    if (this.loading()) {
      return;
    }

    this.isLoadingCollections = true;
    this.collectionOffset.set(0);

    try {
      const result = await withErrorHandling(
        async () => {
          const response = await this.collectionsApi.listCollections(connId, dbName, 0, 10);
          return {
            collections: response.collections,
            total: response.collections.reduce((sum, c) => sum + c.count, 0),
            hasMore: response.hasMore,
            totalCount: response.totalCount,
          };
        },
        { loading: this.loading, context: "LoadCollections" },
        { errorHandler: this.errorHandler, toastService: this.toast }
      );

      if (result.success && result.data) {
        this.collections.set(result.data.collections);
        this.totalDocuments.set(result.data.total);
        this.collectionHasMore.set(result.data.hasMore);
        this.collectionTotalCount.set(result.data.totalCount);
        this.collectionOffset.set(10);
      }
    } finally {
      this.isLoadingCollections = false;
    }
  }

  async loadMoreCollections() {
    const connId = this.connectionId();
    const dbName = this.databaseName();
    if (!connId || !dbName || this.isLoadingCollections || this.loadingMore() || !this.collectionHasMore()) {
      return;
    }

    this.loadingMore.set(true);
    try {
      const response = await this.collectionsApi.listCollections(
        connId,
        dbName,
        this.collectionOffset(),
        10
      );

      this.collections.update((cols) => [...cols, ...response.collections]);
      this.collectionHasMore.set(response.hasMore);
      this.collectionTotalCount.set(response.totalCount);
      this.collectionOffset.update((off) => off + 10);
    } catch (e) {
      this.errorHandler.handleError(e, "Loading more collections");
    } finally {
      this.loadingMore.set(false);
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
      this.errorHandler.handleError(e, "Creating collection");
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
      this.errorHandler.handleError(e, "Renaming collection");
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
      this.errorHandler.handleError(e, "Deleting collection");
    }
  }

  async onAddDbModalAdded(data: { name: string; path: string }) {
    const connId = this.connectionId();
    if (!connId) return;

    try {
      await this.decentralizationApi.saveDatabase(connId, data.name, data.path || undefined);
      this.showAddDbModal.set(false);
      this.goBack();
    } catch (e) {
      this.errorHandler.handleError(e, "Adding database");
    }
  }

  onAddDbModalCancelled() {
    this.showAddDbModal.set(false);
  }
}