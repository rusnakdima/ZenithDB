import { Component, input, output, signal, inject, OnInit } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionSummary } from "@entities/entities.connection.config";
import { ProviderUtils } from "@shared/utils/provider.utils";
import { ConnectionStatusBadgeComponent } from "@shared/components/connection-status-badge/connection-status-badge.component";
@Component({
  selector: "app-connection-card",
  standalone: true,
  imports: [MatIconModule, ConnectionStatusBadgeComponent],
  templateUrl: "./connection-card.component.html",
})
export class ConnectionCardComponent implements OnInit {
  connection = input.required<ConnectionSummary>();
  viewMode = input<"grid" | "list">("grid");
  connect = output<ConnectionSummary>();
  delete = output<ConnectionSummary>();
  duplicate = output<ConnectionSummary>();
  edit = output<ConnectionSummary>();
  showActions = signal(false);
  providerUtils = inject(ProviderUtils);
  ngOnInit(): void {}
  get lastConnectedLabel(): string {
    return "Last connected: 2 days ago";
  }
  onConnect(): void {
    this.connect.emit(this.connection());
  }
  onDelete(event: Event): void {
    event.stopPropagation();
    this.delete.emit(this.connection());
  }
  onDuplicate(event: Event): void {
    event.stopPropagation();
    this.duplicate.emit(this.connection());
  }
  onEdit(event: Event): void {
    event.stopPropagation();
    this.edit.emit(this.connection());
  }
  showCardActions(): void {
    this.showActions.set(true);
  }
  hideCardActions(): void {
    this.showActions.set(false);
  }
}
