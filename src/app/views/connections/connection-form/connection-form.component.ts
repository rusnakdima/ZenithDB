import { Component, inject, signal, computed, OnInit, output } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { CheckboxComponent } from "@shared/components/checkbox/checkbox.component";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ProviderUtils } from "@shared/utils/provider.utils";
import {
  ConnectionConfig,
  ConnectionHealth,
  ConnectionSummary,
  DatabaseMeta,
} from "@shared/models/connection.config";
import { ProviderType } from "@shared/models/provider.model";
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
  imports: [FormsModule, MatIconModule, ModalComponent, CheckboxComponent],
  templateUrl: "./connection-form.component.html",
})
export class ConnectionFormComponent implements OnInit {
  closed = output<void>();

  private db = inject(DatabaseService);
  private connState = inject(ConnectionStateService);
  private providerUtils = inject(ProviderUtils);
  router = inject(Router);
  route = inject(ActivatedRoute);

  editingId: string | null = null;
  isEditing = signal(false);

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
  availableDatabases = signal<DatabaseMeta[]>([]);
  loadingDatabases = signal(false);
  selectedDatabases = signal<string[]>([]);
  databasesLoaded = signal(false);

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

  stepTitles: Record<WizardStep, string> = {
    1: "Choose Provider",
    2: "Connection Details",
    3: "Test & Save",
  };

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get("id");
    if (id && id !== "new") {
      this.editingId = id;
      this.isEditing.set(true);
      this.loadConnectionForEdit(id);
    }

    const duplicateId = this.route.snapshot.queryParamMap.get("duplicate");
    if (duplicateId) {
      this.loadConnectionForDuplicate(duplicateId);
    }
  }

  onClose() {
    this.closed.emit();
    this.router.navigate(["/connections"]);
  }

  private async loadConnectionForEdit(id: string) {
    try {
      const conn = await this.db.getConnection(id);
      this.editingId = id;
      this.name = conn.config.name;
      const innerConfig = conn.config.config;
      this.provider = this.providerUtils.toProviderType(innerConfig.type);
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
      if (this.provider === "postgres" || this.provider === "mysql" || this.provider === "mongo") {
        if (this.database) {
          this.selectedDatabases.set(this.database.split(",").map((d) => d.trim()));
        }
        setTimeout(() => this.onUriChange(), 100);
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
      this.provider = this.providerUtils.toProviderType(innerConfig.type);
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
      if (this.provider === "postgres" || this.provider === "mysql" || this.provider === "mongo") {
        if (this.database) {
          this.selectedDatabases.set(this.database.split(",").map((d) => d.trim()));
        }
        setTimeout(() => this.onUriChange(), 100);
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
    this.availableDatabases.set([]);
    this.selectedDatabases.set([]);
    this.databasesLoaded.set(false);
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

  async onUriChange() {
    if (
      (this.provider === "postgres" || this.provider === "mysql" || this.provider === "mongo") &&
      this.uri &&
      this.uri.length > 10
    ) {
      this.availableDatabases.set([]);
      this.selectedDatabases.set([]);
      this.loadingDatabases.set(true);
      this.databasesLoaded.set(false);
      try {
        const dbs = await this.db.listDatabasesForUri(this.provider, this.uri);
        this.availableDatabases.set(dbs);
        this.databasesLoaded.set(true);
      } catch (e) {
        console.error("Failed to load databases:", e);
      } finally {
        this.loadingDatabases.set(false);
      }
    }
  }

  toggleDatabase(dbName: string) {
    const current = this.selectedDatabases();
    if (current.includes(dbName)) {
      this.selectedDatabases.set(current.filter((n) => n !== dbName));
    } else {
      this.selectedDatabases.set([...current, dbName]);
    }
    this.database = this.selectedDatabases().join(",");
  }

  onDatabaseCheckboxChange(event: boolean, dbName: string) {
    if (event) {
      if (!this.selectedDatabases().includes(dbName)) {
        this.selectedDatabases.set([...this.selectedDatabases(), dbName]);
      }
    } else {
      this.selectedDatabases.set(this.selectedDatabases().filter((n) => n !== dbName));
    }
    this.database = this.selectedDatabases().join(",");
  }

  isDatabaseSelected(dbName: string): boolean {
    return this.selectedDatabases().includes(dbName);
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
      this.onClose();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      this.saving.set(false);
    }
  }

  private buildConfig(): any {
    const configType = this.providerUtils.toConfigType(this.provider);

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
    this.onClose();
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
