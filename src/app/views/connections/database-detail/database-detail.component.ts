import { Component, inject, signal, OnInit, OnDestroy } from "@angular/core";
import { Router, RouterLink, ActivatedRoute } from "@angular/router";
import { TitleCasePipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { CollectionMeta, ConnectionSummary } from "@shared/models/connection.config";
import { Subscription } from "rxjs";

@Component({
  selector: "app-database-detail",
  standalone: true,
  imports: [RouterLink, MatIconModule, TitleCasePipe],
  templateUrl: "./database-detail.component.html",
})
export class DatabaseDetailComponent implements OnInit, OnDestroy {
  private db = inject(DatabaseService);
  private connState = inject(ConnectionStateService);
  route = inject(ActivatedRoute);
  router = inject(Router);

  connectionId = signal<string | null>(null);
  connectionName = signal<string | null>(null);
  databaseName = signal<string | null>(null);
  provider = signal<string | null>(null);
  collections = signal<CollectionMeta[]>([]);
  loading = signal(true);
  totalDocuments = signal(0);

  private routeSub: Subscription | null = null;

  async ngOnInit() {
    this.routeSub = this.route.paramMap.subscribe(async (params) => {
      const id = params.get("id");
      const dbName = params.get("dbName");

      if (id) {
        this.connectionId.set(id);
        this.databaseName.set(dbName);

        const connections = await this.db.listConnections();
        const conn = connections.find((c) => c.id === id);
        if (conn) {
          this.connectionName.set(conn.name);
          this.provider.set(conn.provider);
          this.connState.setActiveConnection(conn);
        }

        await this.loadCollections();
      }
    });

    this.updateProviderIcon();
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
  }

  private updateProviderIcon() {
    const p = this.provider()?.toLowerCase() || "";
    if (p.includes("json")) {
      return "description";
    }
    if (p.includes("mongo")) return "eco";
    if (p.includes("postgres")) return "storage";
    if (p.includes("redis")) return "flash_on";
    if (p.includes("mysql")) return "storage";
    if (p.includes("sqlite")) return "insert_drive_file";
    return "dns";
  }

  async loadCollections() {
    this.loading.set(true);
    try {
      const connId = this.connectionId();
      const dbName = this.databaseName();

      if (connId && dbName) {
        const collections = await this.db.listCollections(connId, dbName);
        this.collections.set(collections);

        const total = collections.reduce((sum, c) => sum + c.count, 0);
        this.totalDocuments.set(total);
      }
    } catch (e) {
      console.error("Failed to load collections:", e);
    } finally {
      this.loading.set(false);
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
}
