import { Component, input, output, signal, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionSummary } from "@shared/models/connection.config";
import { ProviderUtils } from "@shared/utils/provider.utils";

@Component({
  selector: "app-connection-card",
  standalone: true,
  imports: [MatIconModule],
  templateUrl: "./connection-card.component.html",
})
export class ConnectionCardComponent {
  connection = input.required<ConnectionSummary>();
  viewMode = input<"grid" | "list">("grid");

  connect = output<ConnectionSummary>();
  delete = output<ConnectionSummary>();
  duplicate = output<ConnectionSummary>();
  edit = output<ConnectionSummary>();

  showActions = signal(false);
  providerUtils = inject(ProviderUtils);

  get statusClass(): string {
    return this.connection().status === "connected"
      ? "card-status-connected"
      : "card-status-offline";
  }

  get statusLabel(): string {
    return this.connection().status === "connected" ? "CONNECTED" : "OFFLINE";
  }

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
