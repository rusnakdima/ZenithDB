import { Component, input, output } from "@angular/core";
import { ConnectionSummary } from "../../../shared/models/connection.config";

@Component({
  selector: "app-connection-card",
  standalone: true,
  templateUrl: "./connection-card.component.html",
  styleUrl: "./connection-card.component.css",
})
export class ConnectionCardComponent {
  connection = input.required<ConnectionSummary>();

  connect = output<ConnectionSummary>();
  delete = output<ConnectionSummary>();

  get providerIcon(): string {
    const provider = this.connection().provider?.toLowerCase() || "";
    if (provider.includes("mongo")) return "fa-leaf";
    if (provider.includes("postgres")) return "fa-database";
    if (provider.includes("redis")) return "fa-bolt";
    if (provider.includes("mysql")) return "fa-database";
    if (provider.includes("sqlite")) return "fa-file";
    return "fa-server";
  }

  get statusClass(): string {
    return this.connection().status === "connected" ? "status-connected" : "status-offline";
  }

  get statusLabel(): string {
    return this.connection().status === "connected" ? "CONNECTED" : "OFFLINE";
  }

  onConnect(): void {
    this.connect.emit(this.connection());
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    this.delete.emit(this.connection());
  }
}
