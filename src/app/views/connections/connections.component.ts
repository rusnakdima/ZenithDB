import { Component, inject, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { ConnectionCardComponent } from "./connection-card/connection-card.component";
import { DatabaseService } from "../../shared/services/database.service";
import { ConnectionSummary } from "../../shared/models/connection.config";

@Component({
  selector: "app-connections",
  standalone: true,
  imports: [RouterLink, ConnectionCardComponent],
  templateUrl: "./connections.component.html",
  styleUrl: "./connections.component.css",
})
export class ConnectionsComponent implements OnInit {
  connections = signal<ConnectionSummary[]>([]);
  loading = signal(true);

  private db = inject(DatabaseService);

  async ngOnInit() {
    this.loading.set(true);
    this.connections.set(await this.db.listConnections());
    this.loading.set(false);
  }

  onConnect(connection: ConnectionSummary): void {
    console.log("Connect to:", connection);
  }

  onDelete(connection: ConnectionSummary): void {
    console.log("Delete:", connection);
  }
}
