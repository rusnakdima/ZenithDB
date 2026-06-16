import {
  Component,
  output,
  inject,
  signal,
  OnInit,
  OnDestroy,
  DestroyRef,
  effect,
  computed,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { Router, RouterLink, NavigationEnd } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { DataStoreService } from "@shared/services/core/unified-storage.service";
import { CollectionMeta, SystemMetrics, ConnectionSummary } from "@shared/models/connection.config";
import { interval, Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { ProviderUtils } from "@shared/utils/provider.utils";
import { ThemeService } from "@shared/services/theme.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { MetricsApiService } from "@shared/services/metrics-api.service";
import { ConnectionFormService } from "@shared/services/connection-form.service";
import { TreeNode } from "@shared/models/tree-node.model";
import { ConfirmService } from "@shared/services/confirm.service";
import { ToastService } from "@services/toast.service";
import { DatabaseService } from "@shared/services/database.service";
import { findById } from "@shared/utils/array.utils";

@Component({
  selector: "app-sidebar",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule],
  templateUrl: "./sidebar.component.html",
})
export class SidebarComponent implements OnInit {
  providerUtils = inject(ProviderUtils);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private metricsApi = inject(MetricsApiService);
  private connState = inject(ConnectionStateService);
  dataStore = inject(DataStoreService);
  themeService = inject(ThemeService);
  private errorHandler = inject(ErrorHandlerService);
  private connectionFormService = inject(ConnectionFormService);
  private confirmService = inject(ConfirmService);
  private toast = inject(ToastService);
  private db = inject(DatabaseService);
  private cdr = inject(ChangeDetectorRef);
  collectionSelected = output<string>();

  isStatsCollapsed = signal(true);
  searchQuery = signal("");
  activeCollection = signal<string | null>(null);
  systemStatus = signal<SystemMetrics | null>(null);
  databases = signal<TreeNode[]>([]);
  expandedConnections = signal<Set<string>>(new Set());
  loadingDatabases = signal(false);
  loadingCollections = signal<Set<string>>(new Set());
  currentUrl = signal("");
  isExpandingRoute = signal(false);
  isLoadingConnectionRoute = signal(false);

  databaseOffset = signal(0);
  databaseHasMore = signal(false);
  databaseTotalCount = signal(0);

  private statusSubscription: Subscription | null = null;
  private connectionStatusSubscription: Subscription | null = null;
  private routerSub: Subscription | null = null;

  contextMenu = signal<{ show: boolean; x: number; y: number; node: TreeNode | null }>({
    show: false,
    x: 0,
    y: 0,
    node: null,
  });

  isAtConnections = computed(
    () => this.currentUrl() === "/connections" || this.currentUrl() === "/connections/"
  );
  isAtConnectionPage = computed(() => /^\/connections\/[^/]+$/.test(this.currentUrl()));
  isAtExplorer = computed(() => /^\/connections\/[^/]+\/[^/]+\/explorer$/.test(this.currentUrl()));
  isAtDatabasePage = computed(
    () =>
      /^\/connections\/[^/]+\/[^/]+$/.test(this.currentUrl()) &&
      !this.currentUrl().endsWith("/explorer")
  );
  isAtQuery = computed(() => this.currentUrl().startsWith("/query"));

  activeConnectionId = computed(() => {
    const match = this.currentUrl().match(/^\/connections\/([^/]+)/);
    return match ? match[1] : null;
  });

  activeDatabaseName = computed(() => {
    const match = this.currentUrl().match(/^\/connections\/[^/]+\/([^/]+)$/);
    return match ? match[1] : null;
  });

  private lastProcessedUrl = "";
  private routeEffectDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private routeEffect = effect(() => {
    const dbName = this.activeDatabaseName();
    const connId = this.activeConnectionId();
    const currentUrl = this.currentUrl();

    if (this.routeEffectDebounceTimer) {
      clearTimeout(this.routeEffectDebounceTimer);
    }

    this.routeEffectDebounceTimer = setTimeout(() => {
      if (this.lastProcessedUrl === currentUrl) {
        return;
      }
      this.lastProcessedUrl = currentUrl;

      if (dbName && connId && connId !== "new") {
        this.expandDatabaseForRoute(connId, dbName);
      } else if (!dbName && connId && connId !== "new") {
        this.loadConnectionForRoute(connId);
      }
    }, 100);
  });

  ngOnInit() {
    this.routerSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentUrl.set((e as NavigationEnd).urlAfterRedirects);
      });
    this.currentUrl.set(this.router.url);

    this.fetchSystemStatusInBackground();

    this.destroyRef.onDestroy(() => {
      this.routerSub?.unsubscribe();
      this.statusSubscription?.unsubscribe();
      this.connectionStatusSubscription?.unsubscribe();
      if (this.routeEffectDebounceTimer) {
        clearTimeout(this.routeEffectDebounceTimer);
      }
    });
  }

  async expandDatabaseForRoute(connId: string, dbName: string) {
    if (this.isExpandingRoute() || this.isLoadingConnectionRoute()) {
      return;
    }
    this.isExpandingRoute.set(true);
    try {
      const conn = findById(this.dataStore.getConnections(), connId);
      if (!conn) {
        this.isExpandingRoute.set(false);
        return;
      }

      if (this.connState.activeConnectionId() !== connId) {
        this.connState.setActiveConnection(conn);
      }

      if (!this.expandedConnections().has(connId)) {
        this.expandedConnections.update((set) => {
          const newSet = new Set(set);
          newSet.add(connId);
          return newSet;
        });
      }

      if (this.databases().length === 0 && !this.loadingDatabases()) {
        this.loadDatabasesInBackground(connId);
      }

      const dbNode = this.databases().find((d) => d.name === dbName);
      if (dbNode) {
        dbNode.expanded = true;
        if (dbNode.children && dbNode.children.length > 0) {
          this.databases.update((dbs) => [...dbs]);
          this.isExpandingRoute.set(false);
          return;
        }
        this.loadCollectionsInBackground(dbNode, connId);
        this.databases.update((dbs) => [...dbs]);
      }
    } finally {
      this.isExpandingRoute.set(false);
    }
  }

  collapseAllDatabases() {
    const current = this.databases();
    if (current.length > 0) {
      const collapsed = current.map((db) => ({ ...db, expanded: false }));
      this.databases.set(collapsed);
    }
  }

  async loadConnectionForRoute(connId: string) {
    if (this.isLoadingConnectionRoute() || this.isExpandingRoute()) {
      return;
    }
    if (
      this.expandedConnections().has(connId) &&
      this.databases().length > 0 &&
      !this.loadingDatabases()
    ) {
      return;
    }

    const conn = findById(this.dataStore.getConnections(), connId);
    if (!conn) {
      return;
    }

    if (!this.expandedConnections().has(connId)) {
      this.expandedConnections.update((set) => {
        const newSet = new Set(set);
        newSet.add(connId);
        return newSet;
      });
    }

    if (this.connState.activeConnectionId() !== connId) {
      this.connState.setActiveConnection(conn);
    }

    const cachedDatabases = this.dataStore.getDatabases(connId);
    if (cachedDatabases.length > 0) {
      this.databases.set(
        cachedDatabases.map((db) => ({
          name: typeof db === "string" ? db : db.name,
          type: "database" as const,
          expanded: false,
          children: [],
        }))
      );
    }

    this.loadDatabasesInBackground(connId);

    if (this.isSingleDatabaseProvider() && this.databases().length === 1) {
      const db = this.databases()[0];
      this.router.navigate(["/connections", connId, db.name]);
    }
  }

  isSingleDatabaseProvider(): boolean {
    const p = this.connState.activeProvider();
    return p === "sqlite" || p === "json";
  }

  navigateToWorkbench() {
    this.router.navigate(["/query"]);
  }

  navigateToConnections() {
    this.router.navigate(["/connections"]);
  }

  openNewConnection() {
    this.connectionFormService.openNew();
  }

  getActiveConnectionName(): string {
    const conn = this.dataStore.getConnections().find((c) => c.id === this.activeConnectionId());
    return conn?.name || "Unknown";
  }

  async fetchSystemStatusInBackground() {
    this.metricsApi
      .fetchMetrics()
      .then((metrics) => {
        this.systemStatus.set(metrics);
      })
      .catch(() => {});
  }

  fetchConnectionsInBackground() {}

  refreshConnectionStatusesInBackground() {
    const connections = this.dataStore.connections();
    for (const conn of connections) {
      this.dataStore
        .testConnectionStatus(conn.id)
        .then((result) => {
          if (result) {
            this.dataStore.updateConnection(conn.id, { status: result.status });
          }
        })
        .catch((e) =>
          this.errorHandler.handleError(e, "SidebarComponent.testConnectionStatusInBackground")
        );
    }
  }

  loadDatabasesInBackground(connId: string) {
    this.loadingDatabases.set(true);
    this.dataStore
      .listDatabasesPaginated(connId, 0, 10)
      .then((result) => {
        if (this.connState.activeConnectionId() !== connId) {
          this.loadingDatabases.set(false);
          return;
        }
        this.databaseHasMore.set(result.hasMore);
        this.databaseTotalCount.set(result.totalCount);
        const dbNodes: TreeNode[] = result.databases.map((db) => ({
          name: db.name,
          type: "database" as const,
          expanded: false,
          children: [],
        }));
        this.databases.set(dbNodes);
        this.dataStore.updateDatabases(connId, result.databases);
      })
      .catch((e) => {
        this.errorHandler.handleError(e, "Loading databases");
        this.databases.set([]);
      })
      .finally(() => {
        this.loadingDatabases.set(false);
      });
  }

  async refreshConnectionStatuses() {
    try {
      const connections = this.dataStore.connections();
      const results = await Promise.all(
        connections.map((conn) => this.dataStore.testConnectionStatus(conn.id))
      );
      results.forEach((result, index) => {
        if (result) {
          this.dataStore.updateConnection(connections[index].id, { status: result.status });
        }
      });
    } catch (e) {
      this.errorHandler.handleError(e, "Refreshing connection statuses");
    }
  }

  selectConnection(conn: ConnectionSummary) {
    this.connState.setActiveConnection(conn);
    this.router.navigate(["/connections", conn.id]);
    this.loadDatabasesInBackground(conn.id);
  }

  testConnectionStatusInBackground(connId: string) {
    this.dataStore
      .testConnectionStatus(connId)
      .then((result) => {
        if (result) {
          this.dataStore.updateConnection(connId, { status: result.status });
        }
      })
      .catch(() => {});
  }

  async selectConnectionById(connId: string) {
    const conn = findById(this.dataStore.getConnections(), connId);
    if (conn) {
      this.selectConnection(conn);
    }
  }

  async loadDatabases(connId: string) {
    this.loadDatabasesInBackground(connId);
  }

  async loadMoreDatabases(connId: string) {
    if (!this.databaseHasMore()) return;
    if (this.loadingDatabases()) return;
    try {
      this.loadingDatabases.set(true);
      const newOffset = this.databaseOffset() + 10;
      const result = await this.dataStore.listDatabasesPaginated(connId, newOffset, 10);
      if (this.connState.activeConnectionId() !== connId) {
        this.loadingDatabases.set(false);
        return;
      }
      this.databaseOffset.set(newOffset);
      this.databaseHasMore.set(result.hasMore);
      this.databaseTotalCount.set(result.totalCount);
      const newDbNodes: TreeNode[] = result.databases.map((db) => ({
        name: db.name,
        type: "database" as const,
        expanded: false,
        children: [],
      }));
      this.databases.update((dbs) => [...dbs, ...newDbNodes]);
    } catch (e) {
      this.errorHandler.handleError(e, "Loading more databases");
    } finally {
      this.loadingDatabases.set(false);
    }
  }

  loadCollectionsInBackground(dbNode: TreeNode, connId: string) {
    const key = `${connId}:${dbNode.name}`;
    if (this.loadingCollections().has(key)) {
      return;
    }

    this.loadingCollections.update((set) => {
      const newSet = new Set(set);
      newSet.add(key);
      return newSet;
    });

    this.dataStore
      .listCollectionsPaginated(connId, dbNode.name)
      .then((collections) => {
        dbNode.children = collections.collections.map((c) => ({
          name: c.name,
          type: "collection" as const,
          expanded: false,
          collection: c,
        }));
        this.databases.update((dbs) => [...dbs]);
      })
      .catch(() => {})
      .finally(() => {
        this.loadingCollections.update((set) => {
          const newSet = new Set(set);
          newSet.delete(key);
          return newSet;
        });
      });
  }

  async toggleConnection(connId: string, event: Event) {
    event.stopPropagation();
    if (this.expandedConnections().has(connId)) {
      this.expandedConnections.update((set) => {
        const newSet = new Set(set);
        newSet.delete(connId);
        return newSet;
      });
    } else {
      this.expandedConnections.update((set) => {
        const newSet = new Set(set);
        newSet.add(connId);
        return newSet;
      });
      const conn = findById(this.dataStore.getConnections(), connId);
      if (conn) {
        this.connState.setActiveConnection(conn);
      }
      this.loadDatabases(connId);
    }
  }

  toggleDatabase(node: TreeNode, event: Event) {
    event.stopPropagation();
    node.expanded = !node.expanded;

    if (
      node.expanded &&
      node.type === "database" &&
      (!node.children || node.children.length === 0)
    ) {
      const connId = this.activeConnectionId();
      if (connId) {
        this.loadCollectionsInBackground(node, connId);
      }
    }

    this.databases.update((dbs) => [...dbs]);
  }

  onCollectionClick(node: TreeNode) {
    if (node.type === "collection") {
      this.activeCollection.set(node.name);
      this.collectionSelected.emit(node.name);
      const connId = this.activeConnectionId();
      const dbName = this.activeDatabaseName();
      if (connId && dbName) {
        this.router.navigate(["/connections", connId, dbName, "explorer"], {
          queryParams: { collection: node.name },
        });
      }
    }
  }

  onDatabaseClick(node: TreeNode, event: Event) {
    event.stopPropagation();
    const connId = this.activeConnectionId();
    if (connId) {
      this.router.navigate(["/connections", connId, node.name]);
    }
  }

  isConnectionExpanded(connId: string): boolean {
    return this.expandedConnections().has(connId);
  }

  getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      optimal: "bg-green-500",
      warning: "bg-yellow-500",
      critical: "bg-red-500",
    };
    return colorMap[status] || "bg-green-500";
  }

  getCpuPercent(): string {
    const status = this.systemStatus();
    if (!status) return "0%";
    return status.cpu_usage.toFixed(1) + "%";
  }

  getRamDisplay(): string {
    const status = this.systemStatus();
    if (!status) return "0/0";
    return `${this.providerUtils.formatBytes(status.ram_used)} / ${this.providerUtils.formatBytes(status.ram_total)}`;
  }

  getDiskPercent(): string {
    const status = this.systemStatus();
    if (!status || !status.disk_total) return "0";
    return ((status.disk_used / status.disk_total) * 100).toFixed(0);
  }

  getNetworkDisplay(): string {
    const status = this.systemStatus();
    if (!status) return "0";
    return `${this.providerUtils.formatBytes(status.network_transmitted)}/s`;
  }

  formatUptime(): string {
    const status = this.systemStatus();
    if (!status) return "0m";
    const seconds = status.uptime;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.join(" ") || "0m";
  }

  toggleStats() {
    this.isStatsCollapsed.update((v) => !v);
  }

  showContextMenu(event: MouseEvent, node: TreeNode) {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({
      show: true,
      x: event.clientX,
      y: event.clientY,
      node,
    });
  }

  hideContextMenu() {
    this.contextMenu.set({ show: false, x: 0, y: 0, node: null });
  }

  onBrowseDataClick() {
    const node = this.contextMenu().node;
    if (node?.type === "collection") {
      this.onCollectionClick(node);
    }
    this.hideContextMenu();
  }

  onCollectionDetailsClick() {
    const node = this.contextMenu().node;
    if (node?.type === "collection" && node.collection) {
      this.router.navigate(["/connections", this.activeConnectionId()]);
    }
    this.hideContextMenu();
  }

  onRefreshClick() {
    const node = this.contextMenu().node;
    if (node?.type === "collection" && node.collection) {
      this.loadCollectionData(node.collection.name);
    } else if (node?.type === "database") {
      const connId = this.activeConnectionId();
      if (connId) {
        this.loadDatabasesInBackground(connId);
      }
    }
    this.hideContextMenu();
  }

  onDeleteClick() {
    const node = this.contextMenu().node;
    if (node?.type === "collection" && node.collection) {
      this.deleteCollection(node.collection.name);
    }
    this.hideContextMenu();
  }

  onNewCollectionClick() {
    const node = this.contextMenu().node;
    if (node?.type === "database") {
      this.router.navigate(["/connections", this.activeConnectionId(), node.name], {
        queryParams: { newCollection: true },
      });
    }
    this.hideContextMenu();
  }

  onRenameCollection() {
    const node = this.contextMenu().node;
    if (node?.type === "collection") {
      const newName = prompt(`Rename collection "${node.name}" to:`);
      if (newName && newName !== node.name) {
        this.renameCollection(node.name, newName);
      }
    }
    this.hideContextMenu();
  }

  private loadCollectionData(collection: string) {
    const connId = this.activeConnectionId();
    if (connId) {
      this.dataStore
        .queryData(collection, { limit: 100 })
        .catch((e) => this.errorHandler.handleError(e, "loadCollectionData"));
    }
  }

  private async deleteCollection(collection: string): Promise<void> {
    const confirmed = await this.confirmService.confirmDelete(collection);
    if (!confirmed) return;

    try {
      await this.db.dropCollection(collection);
      this.toast.success(`Collection "${collection}" deleted`);
      const connId = this.activeConnectionId();
      const dbName = this.activeDatabaseName();
      if (connId && dbName) {
        this.dataStore.invalidateCollections(connId);
      }
    } catch (e) {
      this.toast.error(`Failed to delete collection: ${(e as Error).message}`);
    }
  }

  private async renameCollection(oldName: string, newName: string): Promise<void> {
    const connId = this.activeConnectionId();
    if (!connId) return;

    try {
      await this.db.renameCollection(connId, oldName, newName);
      this.toast.success(`Collection renamed to "${newName}"`);
      this.dataStore.invalidateCollections(connId);
    } catch (e) {
      this.toast.error(`Failed to rename collection: ${(e as Error).message}`);
    }
  }
}
