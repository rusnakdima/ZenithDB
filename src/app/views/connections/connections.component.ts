import { Component, inject, OnInit, signal, computed } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionCardComponent } from "@views/connections/connection-card/connection-card.component";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { DataStoreService } from "@services/core/data-store.service";
import { ConnectionSummary } from "@shared/models/connection.config";
import { ConfirmService } from "@shared/services/confirm.service";
import { withErrorHandling } from "@shared/utils/error-handler.utils";
import { ConnectionsApiService } from "@shared/services/connections-api.service";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionFormService } from "@shared/services/connection-form.service";

@Component({
  selector: "app-connections",
  standalone: true,
  imports: [RouterLink, ConnectionCardComponent, MatIconModule],
  templateUrl: "./connections.component.html",
})
export class ConnectionsComponent implements OnInit {
  loading = signal(true);
  private db = inject(DatabaseService);
  private connectionsApi = inject(ConnectionsApiService);
  private connState = inject(ConnectionStateService);
  private dataStore = inject(DataStoreService);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  private connectionFormService = inject(ConnectionFormService);

  connections = computed(() => this.connectionsApi.getConnections());

  get connectionsEmpty(): boolean {
    return this.connections().length === 0 && !this.loading();
  }

  async ngOnInit() {
    const connections = this.connectionsApi.getConnections();
    if (connections.length === 0) {
      await withErrorHandling(() => this.connectionsApi.listConnectionsWithRefresh(), {
        loading: this.loading,
        toast: true,
        errorMessage: "Failed to load connections",
      });
    } else {
      this.loading.set(false);
    }
  }

  onConnect(connection: ConnectionSummary): void {
    this.connState.setActiveConnection(connection);
    this.router.navigate(["/connections", connection.id]);
  }

  async onDelete(connection: ConnectionSummary): Promise<void> {
    if (await this.confirm.confirmDelete(connection.name)) {
      await withErrorHandling(() => this.db.deleteConnection(connection.id), {
        toast: true,
        toastSuccess: "Connection deleted",
      });
    }
  }

  onEdit(connection: ConnectionSummary): void {
    this.connectionFormService.openForEdit(connection.id);
  }

  onDuplicate(connection: ConnectionSummary): void {
    this.connectionFormService.openForDuplicate(connection.id);
  }
}
