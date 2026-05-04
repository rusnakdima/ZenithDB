import { Component, inject, signal, computed, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionCardComponent } from "@views/connections/connection-card/connection-card.component";
import { SkeletonLoaderComponent } from "@shared/components/loading/skeleton-loader.component";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ConnectionSummary } from "@shared/models/connection.config";

type SortOption = "name" | "type" | "status" | "lastConnected";
type ViewMode = "grid" | "list";

@Component({
  selector: "app-connection-list",
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    ConnectionCardComponent,
    SkeletonLoaderComponent,
    MatIconModule,
  ],
  templateUrl: "./connection-list.component.html",
})
export class ConnectionListComponent implements OnInit {
  connections = signal<ConnectionSummary[]>([]);
  loading = signal(true);
  searchQuery = signal("");
  sortBy = signal<SortOption>("name");
  viewMode = signal<ViewMode>("grid");

  private db = inject(DatabaseService);
  private connState = inject(ConnectionStateService);

  filteredConnections = computed(() => {
    let result = this.connections();

    const query = this.searchQuery().toLowerCase();
    if (query) {
      result = result.filter(
        (c) => c.name.toLowerCase().includes(query) || c.provider.toLowerCase().includes(query)
      );
    }

    const sort = this.sortBy();
    result = [...result].sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "type":
          return a.provider.localeCompare(b.provider);
        case "status": {
          const statusOrder: Record<string, number> = { connected: 0, disconnected: 1 };
          const aStatus = a.status || "disconnected";
          const bStatus = b.status || "disconnected";
          return statusOrder[aStatus] - statusOrder[bStatus];
        }
        case "lastConnected":
          return 0;
        default:
          return 0;
      }
    });

    return result;
  });

  async ngOnInit() {
    await this.loadConnections();
  }

  async loadConnections() {
    this.loading.set(true);
    try {
      const list = await this.db.listConnections();
      this.connections.set(list);
    } catch (e) {
      console.error("Failed to load connections:", e);
    } finally {
      this.loading.set(false);
    }
  }

  async onConnect(connection: ConnectionSummary) {
    this.connState.activeConnectionId.set(connection.id);
    this.connState.activeConnectionName.set(connection.name);
    this.connState.activeProvider.set(connection.provider);
  }

  async onDelete(connection: ConnectionSummary) {
    if (confirm(`Delete connection "${connection.name}"?`)) {
      await this.db.deleteConnection(connection.id);
      await this.loadConnections();
    }
  }

  onDuplicate(connection: ConnectionSummary) {
    console.log("Duplicate:", connection.name);
  }

  onEdit(connection: ConnectionSummary) {
    console.log("Edit:", connection.name);
  }

  setViewMode(mode: ViewMode) {
    this.viewMode.set(mode);
  }

  setSortBy(sort: SortOption) {
    this.sortBy.set(sort);
  }

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  clearSearch() {
    this.searchQuery.set("");
  }
}
