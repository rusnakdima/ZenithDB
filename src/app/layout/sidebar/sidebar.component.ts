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
} from "@angular/core";
import { Router, RouterLink, NavigationEnd } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { DatabaseService } from "@shared/services/database.service";
import { DataStoreService } from "@services/core/data-store.service";
import {
  CollectionMeta,
  SystemMetrics,
  ConnectionSummary,
  DatabaseMeta,
} from "@shared/models/connection.config";
import { interval, Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { ProviderUtils } from "@shared/utils/provider.utils";
import { ThemeService } from "@shared/services/theme.service";

interface TreeNode {
  name: string;
  type: "database" | "collection";
  expanded: boolean;
  children?: TreeNode[];
  collection?: CollectionMeta;
}

@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [RouterLink, MatIconModule],
  templateUrl: "./sidebar.component.html",
})
export class SidebarComponent implements OnInit {
  providerUtils = inject(ProviderUtils);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  connectionState = inject(ConnectionStateService);
  databaseService = inject(DatabaseService);
  dataStore = inject(DataStoreService);
  themeService = inject(ThemeService);
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
  isAtConnectionPage = computed(
    () =>
      /^\/connections\/[^/]+$/.test(this.currentUrl()) && !this.currentUrl().endsWith("/explorer")
  );
  isAtExplorer = computed(() => /^\/connections\/[^/]+\/explorer$/.test(this.currentUrl()));
  isAtDatabasePage = computed(() =>
    /^\/connections\/[^/]+\/databases\/[^/]+$/.test(this.currentUrl())
  );
  isAtQuery = computed(() => this.currentUrl().startsWith("/query"));

  activeConnectionId = computed(() => {
    const match = this.currentUrl().match(/^\/connections\/([^/]+)/);
    return match ? match[1] : null;
  });

  activeDatabaseName = computed(() => {
    const match = this.currentUrl().match(/^\/connections\/[^/]+\/databases\/([^/]+)$/);
    return match ? match[1] : null;
  });

  private routeEffect = effect(() => {
    const dbName = this.activeDatabaseName();
    const connId = this.activeConnectionId();
    if (dbName && connId) {
      this.expandDatabaseForRoute(connId, dbName);
    } else if (!dbName && connId) {
      this.loadConnectionForRoute(connId);
    }
  });

  ngOnInit() {
    this.fetchSystemStatus();
    this.fetchConnections();

    this.routerSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.currentUrl.set(e.urlAfterRedirects);
      });
    this.currentUrl.set(this.router.url);

    this.statusSubscription = interval(5000).subscribe(() => {
      this.fetchSystemStatus();
    });

    this.connectionStatusSubscription = interval(5000).subscribe(() => {
      this.refreshConnectionStatuses();
    });

    this.destroyRef.onDestroy(() => {
      this.routerSub?.unsubscribe();
      this.statusSubscription?.unsubscribe();
      this.connectionStatusSubscription?.unsubscribe();
    });
  }

  async expandDatabaseForRoute(connId: string, dbName: string) {
    if (this.isExpandingRoute()) {
      return;
    }
    this.isExpandingRoute.set(true);
    try {
      const conn = this.dataStore.getConnections().find((c) => c.id === connId);
      if (!conn) return;

      this.connectionState.setActiveConnection(conn);

      if (!this.expandedConnections().has(connId)) {
        this.expandedConnections.update((set) => {
          const newSet = new Set(set);
          newSet.add(connId);
          return newSet;
        });
        await this.loadDatabases(connId);
      }

      const dbNode = this.databases().find((d) => d.name === dbName);
      if (dbNode) {
        dbNode.expanded = true;
        if (dbNode.children && dbNode.children.length > 0) {
          this.databases.update((dbs) => [...dbs]);
          return;
        }
        await this.loadCollectionsForDatabase(dbNode, connId);
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
    if (this.isLoadingConnectionRoute()) {
      return;
    }
    this.isLoadingConnectionRoute.set(true);
    try {
      const conn = this.dataStore.getConnections().find((c) => c.id === connId);
      if (!conn) return;

      if (!this.expandedConnections().has(connId)) {
        this.expandedConnections.update((set) => {
          const newSet = new Set(set);
          newSet.add(connId);
          return newSet;
        });
      }

      this.connectionState.setActiveConnection(conn);
      await this.loadDatabases(connId);
    } finally {
      this.isLoadingConnectionRoute.set(false);
    }
  }

  navigateToWorkbench() {
    this.router.navigate(["/query"]);
  }

  navigateToConnections() {
    this.router.navigate(["/connections"]);
  }

  openNewConnection() {
    this.router.navigate(["/connections/new"]);
  }

  getActiveConnectionName(): string {
    const conn = this.dataStore.getConnections().find((c) => c.id === this.activeConnectionId());
    return conn?.name || "Unknown";
  }

  async fetchSystemStatus() {
    try {
      const metrics = await this.databaseService.getSystemStatus();
      this.systemStatus.set(metrics);
    } catch (e) {
      console.error("Failed to fetch system status:", e);
    }
  }

  async fetchConnections() {
    try {
      await this.databaseService.listConnections();
    } catch (e) {
      console.error("Failed to fetch connections:", e);
    }
  }

  async refreshConnectionStatuses() {
    try {
      const connections = this.dataStore.getConnections();
      const results = await Promise.all(
        connections.map((conn) => this.databaseService.testConnectionStatus(conn.id))
      );
      results.forEach((result, index) => {
        if (result) {
          this.dataStore.updateConnection(connections[index].id, { status: result.status });
        }
      });
    } catch (e) {
      console.error("Failed to refresh connection statuses:", e);
    }
  }

  async selectConnection(conn: ConnectionSummary) {
    this.connectionState.setActiveConnection(conn);
    this.router.navigate(["/connections", conn.id]);
    this.loadDatabases(conn.id);
    this.testConnectionStatus(conn.id);
  }

  async testConnectionStatus(connId: string) {
    const result = await this.databaseService.testConnectionStatus(connId);
    if (result) {
      this.dataStore.updateConnection(connId, { status: result.status });
    }
  }

  async selectConnectionById(connId: string) {
    const conn = this.dataStore.getConnections().find((c) => c.id === connId);
    if (conn) {
      this.selectConnection(conn);
    }
  }

  async loadDatabases(connId: string) {
    this.loadingDatabases.set(true);
    try {
      const databases = await this.databaseService.listDatabases(connId);
      const dbNodes: TreeNode[] = databases.map((db) => ({
        name: db.name,
        type: "database" as const,
        expanded: false,
        children: [],
      }));
      this.databases.set(dbNodes);
    } catch (e) {
      console.error("Failed to load databases:", e);
      this.databases.set([]);
    } finally {
      this.loadingDatabases.set(false);
    }
  }

  async loadCollectionsForDatabase(dbNode: TreeNode, connId: string) {
    const key = `${connId}:${dbNode.name}`;
    if (this.loadingCollections().has(key)) {
      return;
    }

    this.loadingCollections.update((set) => {
      const newSet = new Set(set);
      newSet.add(key);
      return newSet;
    });

    try {
      const collections = await this.databaseService.listCollections(connId, dbNode.name);
      dbNode.children = collections.map((c) => ({
        name: c.name,
        type: "collection" as const,
        expanded: false,
        collection: c,
      }));
      this.databases.update((dbs) => [...dbs]);
    } finally {
      this.loadingCollections.update((set) => {
        const newSet = new Set(set);
        newSet.delete(key);
        return newSet;
      });
    }
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
      const conn = this.dataStore.getConnections().find((c) => c.id === connId);
      if (conn) {
        this.connectionState.setActiveConnection(conn);
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
        this.loadCollectionsForDatabase(node, connId);
      }
    }

    this.databases.update((dbs) => [...dbs]);
  }

  onCollectionClick(node: TreeNode) {
    if (node.type === "collection") {
      this.activeCollection.set(node.name);
      this.collectionSelected.emit(node.name);
      const connId = this.activeConnectionId();
      if (connId) {
        this.router.navigate(["/connections", connId, "explorer"], {
          queryParams: { collection: node.name },
        });
      }
    }
  }

  onDatabaseClick(node: TreeNode, event: Event) {
    event.stopPropagation();
    const connId = this.activeConnectionId();
    if (connId) {
      this.router.navigate(["/connections", connId, "databases", node.name]);
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
    return `${this.formatBytes(status.ram_used)} / ${this.formatBytes(status.ram_total)}`;
  }

  getDiskPercent(): string {
    const status = this.systemStatus();
    if (!status || !status.disk_total) return "0";
    return ((status.disk_used / status.disk_total) * 100).toFixed(0);
  }

  getNetworkDisplay(): string {
    const status = this.systemStatus();
    if (!status) return "0";
    return `${this.formatBytes(status.network_transmitted)}/s`;
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

  formatBytes(bytes: number): string {
    return this.providerUtils.formatBytes(bytes);
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

  private loadCollectionData(collection: string) {
    const connId = this.activeConnectionId();
    if (connId) {
      this.databaseService.queryData(collection, { limit: 100 }).catch(console.error);
    }
  }

  private deleteCollection(_collection: string) {}
}
