import {
  Component,
  output,
  inject,
  signal,
  OnInit,
  OnDestroy,
  effect,
  Injector,
  runInInjectionContext,
} from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { TitleCasePipe, UpperCasePipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { DatabaseService } from "@shared/services/database.service";
import { StorageService } from "@services/core/storage.service";
import { CollectionMeta, SystemMetrics, ConnectionSummary } from "@shared/models/connection.config";
import { interval, Subscription } from "rxjs";

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
  imports: [RouterLink, TitleCasePipe, UpperCasePipe, MatIconModule],
  templateUrl: "./sidebar.component.html",
})
export class SidebarComponent implements OnInit, OnDestroy {
  private injector = inject(Injector);
  private router = inject(Router);
  connectionState = inject(ConnectionStateService);
  databaseService = inject(DatabaseService);
  storage = inject(StorageService);
  collectionSelected = output<string>();

  isCollapsed = signal(false);
  searchQuery = signal("");
  activeCollection = signal<string | null>(null);
  systemStatus = signal<SystemMetrics | null>(null);
  activeConnectionId = signal<string | null>(null);
  databases = signal<TreeNode[]>([]);
  expandedConnections = signal<Set<string>>(new Set());
  loadingDatabases = signal(false);

  private statusSubscription: Subscription | null = null;

  contextMenu = signal<{ show: boolean; x: number; y: number; node: TreeNode | null }>({
    show: false,
    x: 0,
    y: 0,
    node: null,
  });

  ngOnInit() {
    this.fetchSystemStatus();
    this.fetchConnections();
    this.statusSubscription = interval(5000).subscribe(() => {
      this.fetchSystemStatus();
    });
  }

  ngOnDestroy() {
    this.statusSubscription?.unsubscribe();
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
    this.activeConnectionId.set(conn.id);
    this.connectionState.setActiveConnection(conn);

    if (!this.expandedConnections().has(conn.id)) {
      this.expandedConnections.update((set) => {
        const newSet = new Set(set);
        newSet.add(conn.id);
        return newSet;
      });
    }
    await this.loadDatabases(conn.id);
    this.router.navigate(["/connections", conn.id]);
  }

  async loadDatabases(connId: string) {
    if (this.activeConnectionId() !== connId) return;
    this.loadingDatabases.set(true);
    try {
      const collections = await this.databaseService.listCollections();
      const dbNode: TreeNode = {
        name: connId,
        type: "database",
        expanded: true,
        children: collections.map((c) => ({
          name: c.name,
          type: "collection" as const,
          expanded: false,
          collection: c,
        })),
      };
      this.databases.set([dbNode]);
    } catch (e) {
      console.error("Failed to load databases:", e);
      this.databases.set([]);
    } finally {
      this.loadingDatabases.set(false);
    }
  }

  toggleConnection(connId: string, event: Event) {
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
      this.activeConnectionId.set(connId);
      this.connectionState.setActiveConnection(connId);
      this.loadDatabases(connId);
      this.router.navigate(["/explorer"]);
    }
  }

  toggleDatabase(node: TreeNode, event: Event) {
    event.stopPropagation();
    node.expanded = !node.expanded;
  }

  onCollectionClick(node: TreeNode) {
    if (node.type === "collection") {
      const connId = this.activeConnectionId();
      if (connId) {
        this.connectionState.setActiveConnection(connId);
      }
      this.activeCollection.set(node.name);
      this.collectionSelected.emit(node.name);
      this.router.navigate(["/explorer"], { queryParams: { collection: node.name } });
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

  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  getIconClass(provider: string): string {
    const iconMap: Record<string, string> = {
      postgresql: "storage",
      mongodb: "eco",
      mysql: "storage",
      sqlite: "storage",
      redis: "flash_on",
      json: "description",
    };
    return iconMap[provider] || "storage";
  }

  getProviderColor(provider: string): string {
    const colorMap: Record<string, string> = {
      postgresql: "text-blue-500",
      mongodb: "text-green-500",
      mysql: "text-orange-500",
      sqlite: "text-slate-400",
      redis: "text-red-500",
      json: "text-yellow-500",
    };
    return colorMap[provider] || "text-emerald-500";
  }

  toggleCollapse() {
    this.isCollapsed.update((v) => !v);
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

  refreshNode() {
    this.hideContextMenu();
  }

  newCollection() {
    this.hideContextMenu();
  }

  dropCollection() {
    this.hideContextMenu();
  }
}
