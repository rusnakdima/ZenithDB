import { Component, inject, OnInit, signal, computed } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionCardComponent } from "@views/connections/connection-card/connection-card.component";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { StorageService } from "@services/core/storage.service";
import { ConnectionSummary } from "@shared/models/connection.config";
import { withErrorHandling } from "@shared/utils/error-handler.utils";

@Component({
  selector: "app-connections",
  standalone: true,
  imports: [RouterLink, ConnectionCardComponent, MatIconModule],
  templateUrl: "./connections.component.html",
})
export class ConnectionsComponent implements OnInit {
  loading = signal(true);
  private db = inject(DatabaseService);
  private connState = inject(ConnectionStateService);
  private storage = inject(StorageService);
  private router = inject(Router);

  connections = computed(() => this.storage.connections());

  async ngOnInit() {
    await withErrorHandling(() => this.db.listConnections(), {
      loading: this.loading,
      toast: true,
      errorMessage: "Failed to load connections",
    });
  }

  onConnect(connection: ConnectionSummary): void {
    this.connState.setActiveConnection(connection);
    this.router.navigate(["/connections", connection.id]);
  }

  async onDelete(connection: ConnectionSummary): Promise<void> {
    if (confirm(`Delete connection "${connection.name}"?`)) {
      await withErrorHandling(() => this.db.deleteConnection(connection.id), {
        toast: true,
        toastSuccess: "Connection deleted",
      });
    }
  }

  onEdit(connection: ConnectionSummary): void {
    this.router.navigate(["/connections", connection.id, "edit"]);
  }

  onDuplicate(connection: ConnectionSummary): void {
    this.router.navigate(["/connections/new"], {
      queryParams: { duplicate: connection.id },
    });
  }
}
