import {
  Component,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { Router } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionCardComponent } from "@views/connections/connection-card/connection-card.component";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { DataStoreService } from "@shared/services/core/unified-storage.service";
import { ConnectionSummary } from "@shared/models/connection.config";
import { ConfirmService } from "@shared/services/confirm.service";
import { withErrorHandling } from "@shared/utils/error-handler.utils";
import { ConnectionFormService } from "@shared/services/connection-form.service";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { logger } from "../../services/logger.service";

@Component({
  selector: "app-connections",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  private cdr = inject(ChangeDetectorRef);
  private dataflowLogger = inject(DataflowLoggerService);
  

  connections = this.store.connections;
  private readonly page = "Connections";

  get connectionsEmpty(): boolean {
    return this.connections().length === 0 && !this.loading();
  }

  async ngOnInit() {
    logger.debug("[CONNECTIONS]", "Loading connections");
    await withErrorHandling(() => this.store.refreshConnections(), {
      loading: this.loading,
      toast: true,
      errorMessage: "Failed to load connections",
    });
  }

  onConnect(connection: ConnectionSummary): void {
    logger.log("[CONNECTIONS]", "User action: connect", {
      connectionId: connection.id,
      name: connection.name,
    });
    this.connState.setActiveConnection(connection);
    this.router.navigate(["/connections", connection.id]);
  }

  async onDelete(connection: ConnectionSummary): Promise<void> {
    logger.log("[CONNECTIONS]", "User action: delete", {
      connectionId: connection.id,
      name: connection.name,
    });
    if (await this.confirm.confirmDelete(connection.name)) {
      await withErrorHandling(() => this.store.deleteConnection(connection.id), {
        toast: true,
        toastSuccess: "Connection deleted",
      });
    }
  }

  onEdit(connection: ConnectionSummary): void {
    logger.log("[CONNECTIONS]", "User action: edit", { connectionId: connection.id });
    this.connectionFormService.openForEdit(connection.id);
  }

  onDuplicate(connection: ConnectionSummary): void {
    logger.log("[CONNECTIONS]", "User action: duplicate", { connectionId: connection.id });
    this.connectionFormService.openForDuplicate(connection.id);
  }

  openNewConnection(): void {
    logger.log("[CONNECTIONS]", "User action: openNewConnection");
    this.connectionFormService.openNew();
  }

  async onRefresh(): Promise<void> {
    logger.log("[CONNECTIONS]", "User action: refresh");
    await withErrorHandling(() => this.store.refreshConnections(), {
      loading: this.loading,
      toast: true,
      errorMessage: "Failed to refresh connections",
    });
  }
}
