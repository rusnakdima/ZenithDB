import { Component, inject, signal, OnInit, OnDestroy } from "@angular/core";
import { Router, RouterLink, ActivatedRoute } from "@angular/router";
import { TitleCasePipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { FormsModule } from "@angular/forms";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ProviderUtils } from "@shared/utils/provider.utils";
import {
  ConnectionHealth,
  CollectionMeta,
  ConnectionSummary,
  ConnectionConfig,
} from "@shared/models/connection.config";
import { StatusBadgeComponent } from "@shared/components/status-badge/status-badge.component";
import { Subscription } from "rxjs";

interface DbNode {
  name: string;
  expanded: boolean;
  collections: CollectionMeta[];
}

@Component({
  selector: "app-connection-detail",
  standalone: true,
  imports: [RouterLink, StatusBadgeComponent, TitleCasePipe, MatIconModule, FormsModule],
  templateUrl: "./connection-detail.component.html",
})
export class ConnectionDetailComponent implements OnInit, OnDestroy {
  private db = inject(DatabaseService);
  private connState = inject(ConnectionStateService);
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
  showCreateDb = signal(false);
  newDbName = "";
  creatingDb = signal(false);
  editingDb = signal<string | null>(null);
  editDbName = "";

  providerIcon = signal("dns");

  private routeSub: Subscription | null = null;

  async ngOnInit() {
    this.routeSub = this.route.paramMap.subscribe(async (params) => {
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
            console.error("Failed to load full config:", e);
          }
        }
      } else {
        this.connectionId.set(this.connState.activeConnectionId());
        this.connectionName.set(this.connState.activeConnectionName());
        this.provider.set(this.connState.activeProvider());
        this.fullConfig.set(this.connState.activeConnectionConfig());
      }

      this.updateProviderIcon();
      await this.loadConnectionDetails();
    });

    this.updateProviderIcon();
    await this.loadConnectionDetails();
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
  }

  private updateProviderIcon() {
    this.providerIcon.set(this.providerUtils.getProviderIcon(this.provider() || ""));
  }

  async loadConnectionDetails() {
    this.loading.set(true);
    try {
      if (this.connectionId()) {
        const config = this.fullConfig();
        const [version, collections, healthResult] = await Promise.all([
          this.db.getServerVersion().catch(() => null),
          this.db.listCollections().catch(() => []),
          config ? this.db.testConnection(config.config).catch(() => null) : Promise.resolve(null),
        ]);

        this.serverVersion.set(version);
        this.collections.set(collections);
        this.health.set(healthResult);
      }
    } catch (e) {
      console.error("Failed to load connection details", e);
    } finally {
      this.loading.set(false);
    }
  }

  async testConnection() {
    this.testing.set(true);
    try {
      const fullConfig = this.fullConfig();
      if (!fullConfig) {
        throw new Error("No connection config available");
      }
      const config = {
        name: fullConfig.config.name,
        config: fullConfig.config.config,
      };
      const result = await this.db.testConnection(config);
      this.health.set(result);
    } catch (e) {
      console.error("Test connection failed:", e);
    } finally {
      this.testing.set(false);
    }
  }

  async refresh() {
    await this.loadConnectionDetails();
  }

  async deleteConnection() {
    if (!this.connectionId()) return;
    if (confirm(`Delete connection "${this.connectionName()}"? This action cannot be undone.`)) {
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

  get connectionStatus(): "connected" | "offline" {
    return this.health()?.healthy ? "connected" : "offline";
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

  getDbList(): string[] {
    const colls = this.collections();
    const dbs = new Set<string>();
    colls.forEach((c) => {
      const parts = c.name.split(".");
      if (parts.length > 1) {
        dbs.add(parts[0]);
      } else {
        dbs.add("default");
      }
    });
    return Array.from(dbs);
  }

  getSelectedDatabases(): string[] {
    const config = this.fullConfig();
    if (!config || !config.config || !config.config.config) {
      return [];
    }
    const innerConfig = config.config.config;
    if (innerConfig.database && innerConfig.database.trim()) {
      return innerConfig.database
        .split(",")
        .map((d: string) => d.trim())
        .filter(Boolean);
    }
    if (innerConfig.type === "Json" && innerConfig.path) {
      const pathParts = innerConfig.path.split(/[\/\\]/);
      const folderName = pathParts[pathParts.length - 1] || "root";
      return [folderName];
    }
    return [];
  }

  async createDatabase() {
    if (!this.newDbName.trim()) return;
    this.creatingDb.set(true);
    try {
      await this.db.createDatabase(this.newDbName.trim());
      this.newDbName = "";
      this.showCreateDb.set(false);
      await this.loadConnectionDetails();
    } catch (e) {
      console.error("Failed to create database:", e);
    } finally {
      this.creatingDb.set(false);
    }
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
      await this.db.renameDatabase(connId, oldName, newName);
      const config = this.fullConfig();
      if (config && config.config && config.config.config) {
        const innerConfig = config.config.config;
        const dbs = innerConfig.database.split(",").map((d: string) => d.trim());
        const idx = dbs.indexOf(oldName);
        if (idx >= 0) {
          dbs[idx] = newName;
          innerConfig.database = dbs.join(",");
          await this.db.updateConnection(connId, config.config);
        }
      }
      this.cancelEditDb();
      await this.loadConnectionDetails();
    } catch (e) {
      console.error("Failed to rename database:", e);
      this.cancelEditDb();
    }
  }

  cancelEditDb() {
    this.editingDb.set(null);
    this.editDbName = "";
  }

  async deleteDatabase(dbName: string) {
    if (!confirm(`Delete database "${dbName}"? This cannot be undone.`)) return;

    const connId = this.connectionId();
    if (!connId) return;

    try {
      await this.db.deleteDatabase(connId, dbName);
      const config = this.fullConfig();
      if (config && config.config && config.config.config) {
        const innerConfig = config.config.config;
        const dbs = innerConfig.database
          .split(",")
          .map((d: string) => d.trim())
          .filter(Boolean);
        const idx = dbs.indexOf(dbName);
        if (idx >= 0) {
          dbs.splice(idx, 1);
          innerConfig.database = dbs.join(",");
          await this.db.updateConnection(connId, config.config);
        }
      }
      await this.loadConnectionDetails();
    } catch (e) {
      console.error("Failed to delete database:", e);
    }
  }
}
