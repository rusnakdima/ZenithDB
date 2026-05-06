import {
  Component,
  output,
  inject,
  signal,
  OnInit,
  DestroyRef,
  effect,
  computed,
} from "@angular/core";
import { Router, RouterLink, NavigationEnd } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { DatabaseService } from "@shared/services/database.service";
import { StorageService } from "@services/core/storage.service";
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
  storage = inject(StorageService);
  themeService = inject(ThemeService);
  collectionSelected = output<string>();

  isStatsCollapsed = signal(true);
  searchQuery = signal("");
  activeCollection = signal<string | null>(null);
  systemStatus = signal<SystemMetrics | null>(null);
  databases = signal<TreeNode[]>([]);
  expandedConnections = signal<Set<string>>(new Set());
  loadingDatabases = signal(false);
  currentUrl = signal("");

  private statusSubscription: Subscription | null = null;

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
  isAtQuery = computed(() => this.currentUrl().startsWith("/query"));

  activeConnectionId = computed(() => {
    const match = this.currentUrl().match(/^\/connections\/([^/]+)/);
    return match ? match[1] : null;
  });

  ngOnInit() {
    this.fetchSystemStatus();
    this.fetchConnections();

    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.currentUrl.set(e.urlAfterRedirects);
    });
    this.currentUrl.set(this.router.url);

    this.statusSubscription = interval(5000).subscribe(() => {
      this.fetchSystemStatus();
    });

    this.destroyRef.onDestroy(() => {
      this.statusSubscription?.unsubscribe();
    });
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
    const conn = this.storage.connections().find((c) => c.id === this.activeConnectionId());
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

  async selectConnection(conn: ConnectionSummary) {
    this.connectionState.setActiveConnection(conn);
    this.router.navigate(["/connections", conn.id]);
    this.loadDatabases(conn.id);
  }

  async selectConnectionById(connId: string) {
    const conn = this.storage.connections().find((c) => c.id === connId);
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
    const collections = await this.databaseService.listCollections(connId, dbNode.name);
    dbNode.children = collections.map((c) => ({
      name: c.name,
      type: "collection" as const,
      expanded: false,
      collection: c,
    }));
    this.databases.update((dbs) => [...dbs]);
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
      const conn = this.storage.connections().find((c) => c.id === connId);
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

  onRefreshClick() {
    const node = this.contextMenu().node;
    if (node?.type === "collection" && node.collection) {
    }
    this.hideContextMenu();
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

  onDeleteClick() {
    const node = this.contextMenu().node;
    if (node?.type === "collection" && node.collection) {
    }
    this.hideContextMenu();
  }
}
