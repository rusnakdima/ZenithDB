import { Component, inject, signal, OnInit, OnDestroy, output } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ProviderUtils } from "@shared/utils/provider.utils";
import { parseProviderConfig } from "@shared/utils/provider-config.utils";
import {
  ConnectionConfig,
  ConnectionHealth,
  TestConnectionConfig,
} from "@shared/models/connection.config";
import { ProviderType } from "@shared/models/provider.model";
import { ProviderSelectorComponent } from "../provider-selector/provider-selector.component";
import {
  ConnectionConfigFormComponent,
  ConfigFormData,
} from "../connection-config-form/connection-config-form.component";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { ToastService } from "@services/toast.service";

type WizardStep = 1 | 2 | 3;

@Component({
  selector: "app-connection-form",
  standalone: true,
  imports: [
    MatIconModule,
    ModalComponent,
    ProviderSelectorComponent,
    ConnectionConfigFormComponent,
  ],
  templateUrl: "./connection-form.component.html",
})
export class ConnectionFormComponent implements OnInit, OnDestroy {
  closed = output<void>();

  private db = inject(DatabaseService);
  private connState = inject(ConnectionStateService);
  private errorHandler = inject(ErrorHandlerService);
  private toast = inject(ToastService);
  providerUtils = inject(ProviderUtils);
  router = inject(Router);
  route = inject(ActivatedRoute);

  editingId: string | null = null;
  isEditing = signal(false);

  currentStep = signal<WizardStep>(1);
  provider: ProviderType = "json";
  selectedDatabases = signal<string[]>([]);

  formData = signal<ConfigFormData>({
    name: "",
    path: "",
    uri: "",
    database: "",
    behavior: "folders_as_databases",
    useSsl: false,
  });

  testResult = signal<ConnectionHealth | null>(null);
  testing = signal(false);
  saving = signal(false);

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

  ngOnDestroy() {}

  onClose() {
    this.closed.emit();
    this.router.navigate(["/connections"]);
  }

  private async loadConnectionForEdit(id: string) {
    try {
      const conn = await this.db.getConnection(id);
      this.editingId = id;
      const innerConfig = conn.config.config;
      this.provider = this.providerUtils.toProviderType(innerConfig.type);
      const parsed = parseProviderConfig(innerConfig);
      this.formData.set({
        name: conn.config.name,
        path: parsed.path,
        uri: parsed.uri,
        behavior: parsed.behavior,
        useSsl: false,
      });
    } catch (e) {
      this.errorHandler.handleError(e, "Loading connection for edit");
    }
  }

  private async loadConnectionForDuplicate(id: string) {
    try {
      const conn = await this.db.getConnection(id);
      const innerConfig = conn.config.config;
      this.provider = this.providerUtils.toProviderType(innerConfig.type);
      const parsed = parseProviderConfig(innerConfig);
      this.formData.set({
        name: innerConfig.name + " (Copy)",
        path: parsed.path,
        uri: parsed.uri,
        behavior: parsed.behavior,
        useSsl: false,
      });
    } catch (e) {
      this.errorHandler.handleError(e, "Loading connection for duplicate");
    }
  }

  onProviderSelected(type: ProviderType) {
    this.provider = type;
    this.formData.set({
      name: this.formData().name,
      path: "",
      uri: "",
      behavior: "folders_as_databases",
      useSsl: false,
    });
  }

  onFormDataChange(data: ConfigFormData) {
    this.formData.set(data);
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

  async onBrowseFile(directory: boolean = false) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      let filters: { name: string; extensions: string[] }[] = [];
      if (!directory) {
        if (this.provider === "sqlite") {
          filters = [{ name: "SQLite Database", extensions: ["db", "sqlite", "sqlite3"] }];
        } else {
          filters = [{ name: "JSON Database", extensions: ["json"] }];
        }
      }
      const selected = await open({
        multiple: false,
        directory,
        filters,
      });
      if (selected) {
        this.formData.update((d) => ({ ...d, path: selected as string }));
      }
    } catch (e) {
      this.toast.error("Failed to open file dialog");
    }
  }

  isStep1Valid = signal(true);

  isStep2Valid(): boolean {
    const data = this.formData();
    if (!data.name.trim()) return false;
    switch (this.provider) {
      case "json":
      case "sqlite":
        return !!data.path.trim();
      case "mongo":
      case "redis":
      case "postgres":
      case "mysql":
        return !!data.uri.trim();
      default:
        return false;
    }
  }

  async testConnection() {
    this.testing.set(true);
    try {
      const config = this.buildConfig();
      const result = await this.db.testConnection(config);
      this.testResult.set(result);
    } catch (e) {
      this.testResult.set({
        healthy: false,
        provider: "",
        server_version: String(e),
        latency_ms: undefined,
      });
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
      this.errorHandler.handleError(e, "Saving connection");
    } finally {
      this.saving.set(false);
    }
  }

  private buildConfig(): TestConnectionConfig {
    const data = this.formData();

    switch (this.provider) {
      case "json":
        return {
          name: data.name,
          config: {
            type: "Json",
            name: data.name,
            path: data.path,
            behavior: data.behavior,
          },
        };
      case "sqlite":
        return {
          name: data.name,
          config: {
            type: "Sqlite",
            name: data.name,
            path: data.path,
          },
        };
      case "mongo":
        return {
          name: data.name,
          config: {
            type: "Mongo",
            name: data.name,
            uri: data.uri,
          },
        };
      case "redis":
        return {
          name: data.name,
          config: {
            type: "Redis",
            name: data.name,
            uri: data.uri,
          },
        };
      case "postgres":
        return {
          name: data.name,
          config: {
            type: "Postgres",
            name: data.name,
            uri: data.uri,
          },
        };
      case "mysql":
        return {
          name: data.name,
          config: {
            type: "MySql",
            name: data.name,
            uri: data.uri,
          },
        };
      default:
        return {
          name: data.name,
          config: {
            type: "MySql",
            name: data.name,
            uri: data.uri,
          },
        };
    }
  }

  cancel() {
    this.onClose();
  }
}
