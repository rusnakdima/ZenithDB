import { Component, inject, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { DatabaseService } from "../../../shared/services/database.service";
import { ConnectionConfig, ConnectionHealth } from "../../../shared/models/connection.config";

type ProviderType = "json" | "mongo" | "redis" | "postgres" | "sqlite" | "mysql";

@Component({
  selector: "app-connection-form",
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: "./connection-form.component.html",
  styleUrl: "./connection-form.component.css",
})
export class ConnectionFormComponent {
  private db = inject(DatabaseService);
  router = inject(Router);

  provider: ProviderType = "json";
  name = "";
  path = "";
  uri = "";
  database = "";

  testResult = signal<ConnectionHealth | null>(null);
  testing = signal(false);

  async testConnection() {
    this.testing.set(true);
    this.testResult.set(null);
    try {
      const config = this.buildConfig();
      const result = await this.db.testConnection(config);
      this.testResult.set(result);
    } catch (e: any) {
      this.testResult.set({
        healthy: false,
        provider: this.provider,
        version: "",
        message: e.message || "Connection failed",
      });
    } finally {
      this.testing.set(false);
    }
  }

  async save() {
    const config = this.buildConfig();
    await this.db.saveConnection(config);
    this.router.navigate(["/connections"]);
  }

  cancel() {
    this.router.navigate(["/connections"]);
  }

  private buildConfig(): ConnectionConfig {
    const base = { name: this.name };
    switch (this.provider) {
      case "json":
        return { type: "json", name: this.name, path: this.path };
      case "mongo":
        return { type: "mongo", name: this.name, uri: this.uri, database: this.database };
      case "redis":
        return { type: "redis", name: this.name, uri: this.uri };
      case "postgres":
        return { type: "postgres", name: this.name, uri: this.uri };
      case "sqlite":
        return { type: "sqlite", name: this.name, path: this.path };
      case "mysql":
        return { type: "mysql", name: this.name, uri: this.uri };
    }
  }
}
