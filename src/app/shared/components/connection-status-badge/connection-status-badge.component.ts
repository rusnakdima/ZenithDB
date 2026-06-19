import { Component, input, computed } from "@angular/core";
import { ConnectionSummary } from "@entities/entities.connection.config";

export type ConnectionStatus = "connected" | "disconnected" | undefined;

@Component({
  selector: "app-connection-status-badge",
  standalone: true,
  templateUrl: "./connection-status-badge.component.html",
})
export class ConnectionStatusBadgeComponent {
  status = input.required<ConnectionStatus>();
  size = input<"sm" | "md" | "lg">("sm");

  statusClass = computed(() => {
    const baseClass =
      this.size() === "sm" ? "badge-sm" : this.size() === "md" ? "badge-md" : "badge-lg";
    const statusClass = this.status() === "connected" ? "badge-connected" : "badge-offline";
    return `${baseClass} ${statusClass}`;
  });

  statusLabel = computed(() => {
    return this.status() === "connected" ? "CONNECTED" : "OFFLINE";
  });
}
