import { Component, inject, OnInit, signal } from "@angular/core";
import { Router } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionCardComponent } from "@views/connections/connection-card/connection-card.component";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { DataStoreService } from "@services/core/data-store.service";
import { ConnectionSummary } from "@shared/models/connection.config";
import { ConfirmService } from "@shared/services/confirm.service";
import { withErrorHandling } from "@shared/utils/error-handler.utils";
import { ConnectionFormService } from "@shared/services/connection-form.service";

@Component({
  selector: "app-connections",
  standalone: true,
  imports: [ConnectionCardComponent, MatIconModule],
  templateUrl: "./connections.view.html",
})
export class ConnectionsComponent implements OnInit {
  loading = signal(true);
  private store = inject(DataStoreService);
  private connState = inject(ConnectionStateService);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  private connectionFormService = inject(ConnectionFormService);

  connections = this.store.connections;

  get connectionsEmpty(): boolean {
    return this.connections().length === 0 && !this.loading();
  }

  async ngOnInit() {
    await withErrorHandling(() => this.store.refreshConnections(), {
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
    if (await this.confirm.confirmDelete(connection.name)) {
      await withErrorHandling(() => this.store.deleteConnection(connection.id), {
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

  openNewConnection(): void {
    this.connectionFormService.openNew();
  }

  async onRefresh(): Promise<void> {
    await withErrorHandling(() => this.store.refreshConnections(), {
      loading: this.loading,
      toast: true,
      errorMessage: "Failed to refresh connections",
    });
  }
}
