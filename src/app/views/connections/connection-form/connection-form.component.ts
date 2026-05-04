import { Component, inject, signal, computed, OnInit } from "@angular/core";
import { Router, RouterLink, ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import {
  ConnectionConfig,
  ConnectionHealth,
  ConnectionSummary,
} from "@shared/models/connection.config";

type ProviderType = "json" | "mongo" | "redis" | "postgres" | "sqlite" | "mysql";
type WizardStep = 1 | 2 | 3;

interface ProviderOption {
  type: ProviderType;
  label: string;
  icon: string;
  description: string;
}

@Component({
  selector: "app-connection-form",
  standalone: true,
  imports: [RouterLink, FormsModule, MatIconModule],
  templateUrl: "./connection-form.component.html",
})
export class ConnectionFormComponent implements OnInit {
  private db = inject(DatabaseService);
  private connState = inject(ConnectionStateService);
  router = inject(Router);
  route = inject(ActivatedRoute);

  editingId: string | null = null;

  currentStep = signal<WizardStep>(1);
  provider: ProviderType = "json";
  name = "";
  path = "";
  uri = "";
  database = "";
  host = "localhost";
  port = "";
  username = "";
  password = "";
  useSsl = false;

  testResult = signal<ConnectionHealth | null>(null);
  testing = signal(false);
  saving = signal(false);

  providers: ProviderOption[] = [
    { type: "json", label: "JSON", icon: "description", description: "Local JSON file storage" },
    { type: "mongo", label: "MongoDB", icon: "eco", description: "MongoDB document database" },
    { type: "redis", label: "Redis", icon: "flash_on", description: "Redis in-memory cache" },
    {
      type: "postgres",
      label: "PostgreSQL",
      icon: "storage",
      description: "PostgreSQL relational DB",
    },
    {
      type: "sqlite",
      label: "SQLite",
      icon: "insert_drive_file",
      description: "SQLite file database",
    },
    { type: "mysql", label: "MySQL", icon: "storage", description: "MySQL relational DB" },
  ];

  stepTitles = {
    1: "Choose Provider",
    2: "Connection Details",
    3: "Test & Save",
  };

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get("id");
    if (id && id !== "new") {
      this.editingId = id;
      this.loadConnectionForEdit(id);
    }

    const duplicateId = this.route.snapshot.queryParamMap.get("duplicate");
    if (duplicateId) {
      this.loadConnectionForDuplicate(duplicateId);
    }
  }

  private async loadConnectionForEdit(id: string) {
    try {
      const conn = await this.db.getConnection(id);
      this.editingId = id;
      this.name = conn.config.name;
      const innerConfig = conn.config.config;
      const typeMap: Record<string, ProviderType> = {
        Json: "json",
        Mongo: "mongo",
        Redis: "redis",
        Postgres: "postgres",
        Sqlite: "sqlite",
        MySql: "mysql",
      };
      this.provider = typeMap[innerConfig.type] || (innerConfig.type.toLowerCase() as ProviderType);
      switch (innerConfig.type) {
        case "Json":
        case "Sqlite":
          this.path = innerConfig.path || "";
          break;
        case "Mongo":
          this.uri = innerConfig.uri || "";
          this.database = innerConfig.database || "";
          break;
        case "Redis":
        case "Postgres":
        case "MySql":
          this.uri = innerConfig.uri || "";
          break;
      }
    } catch (e) {
      console.error("Failed to load connection:", e);
    }
  }

  private async loadConnectionForDuplicate(id: string) {
    try {
      const conn = await this.db.getConnection(id);
      const innerConfig = conn.config.config;
      this.name = innerConfig.name + " (Copy)";
      const typeMap: Record<string, ProviderType> = {
        Json: "json",
        Mongo: "mongo",
        Redis: "redis",
        Postgres: "postgres",
        Sqlite: "sqlite",
        MySql: "mysql",
      };
      this.provider = typeMap[innerConfig.type] || (innerConfig.type.toLowerCase() as ProviderType);
      switch (innerConfig.type) {
        case "Json":
        case "Sqlite":
          this.path = innerConfig.path || "";
          break;
        case "Mongo":
          this.uri = innerConfig.uri || "";
          this.database = innerConfig.database || "";
          break;
        case "Redis":
        case "Postgres":
        case "MySql":
          this.uri = innerConfig.uri || "";
          break;
      }
    } catch (e) {
      console.error("Failed to load connection:", e);
    }
  }

  isStep1Valid = computed(() => this.provider !== null);

  isStep2Valid(): boolean {
    if (!this.name.trim()) return false;
    switch (this.provider) {
      case "json":
      case "sqlite":
        return !!this.path.trim();
      case "mongo":
        return !!this.uri.trim() && !!this.database.trim();
      case "redis":
      case "postgres":
      case "mysql":
        return !!this.uri.trim();
      default:
        return false;
    }
  }

  selectProvider(type: ProviderType) {
    this.provider = type;
    this.resetFormFields();
  }

  private resetFormFields() {
    this.path = "";
    this.uri = "";
    this.database = "";
    this.host = "localhost";
    this.port = "";
    this.username = "";
    this.password = "";
    this.useSsl = false;
  }

  nextStep() {
    if (this.currentStep() < 3) {
      this.currentStep.update((s) => (s + 1) as WizardStep);
    }
  }

  prevStep() {
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => (s - 1) as WizardStep);
    }
  }

  async testConnection() {
    this.testing.set(true);
    try {
      const config = this.buildConfig();
      const result = await this.db.testConnection(config);
      this.testResult.set(result);
    } catch (e) {
      this.testResult.set({ ok: false, message: String(e) } as any);
    } finally {
      this.testing.set(false);
    }
  }

  async save() {
    this.saving.set(true);
    try {
      const config = this.buildConfig();
      if (this.editingId) {
        await this.db.deleteConnection(this.editingId);
      }
      await this.db.saveConnection(config);
      this.router.navigate(["/connections"]);
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      this.saving.set(false);
    }
  }

  private buildConfig(): any {
    const typeMap: Record<ProviderType, string> = {
      json: "Json",
      mongo: "Mongo",
      redis: "Redis",
      postgres: "Postgres",
      sqlite: "Sqlite",
      mysql: "MySql",
    };

    const configType = typeMap[this.provider] || this.provider;

    switch (this.provider) {
      case "json":
      case "sqlite":
        return {
          name: this.name,
          config: {
            type: configType,
            name: this.name,
            path: this.path,
          },
        };
      case "mongo":
        return {
          name: this.name,
          config: {
            type: configType,
            name: this.name,
            uri: this.uri,
            database: this.database,
          },
        };
      case "redis":
      case "postgres":
      case "mysql":
        return {
          name: this.name,
          config: {
            type: configType,
            name: this.name,
            uri: this.uri,
          },
        };
      default:
        return {
          name: this.name,
          config: {
            type: configType,
            name: this.name,
            uri: this.uri,
          },
        };
    }
  }

  cancel() {
    this.router.navigate(["/connections"]);
  }

  async browseFile(directory: boolean = false) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        directory,
        filters: directory
          ? []
          : [
              {
                name: "Database Files",
                extensions: ["json", "db", "sqlite", "sqlite3"],
              },
            ],
      });
      if (selected) {
        this.path = selected as string;
      }
    } catch (e) {
      console.error("File dialog error:", e);
    }
  }

  getProviderIcon(provider: ProviderType): string {
    const iconMap: Record<ProviderType, string> = {
      json: "description",
      mongo: "eco",
      redis: "flash_on",
      postgres: "storage",
      sqlite: "insert_drive_file",
      mysql: "storage",
    };
    return iconMap[provider] || "dns";
  }
}
