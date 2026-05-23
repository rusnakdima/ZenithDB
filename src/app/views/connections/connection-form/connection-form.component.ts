import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  output,
  effect,
  ChangeDetectorRef,
} from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { DataStoreService } from "@services/core/data-store.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ProviderUtils } from "@shared/utils/provider.utils";
import { parseProviderConfig } from "@shared/utils/provider-config.utils";
import { ConnectionHealth, TestConnectionConfig } from "@shared/models/connection.config";
import { ProviderType } from "@shared/models/provider.model";
import {
  ConnectionConfigFormComponent,
  ConnectionFormData,
} from "../connection-config-form/connection-config-form.component";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { ToastService } from "@services/toast.service";
import { ConnectionFormService } from "@shared/services/connection-form.service";

@Component({
  selector: "app-connection-form",
  standalone: true,
  imports: [FormsModule, MatIconModule, ModalComponent, ConnectionConfigFormComponent],
  templateUrl: "./connection-form.component.html",
})
export class ConnectionFormComponent implements OnInit, OnDestroy {
  closed = output<void>();

  private store = inject(DataStoreService);
  private connState = inject(ConnectionStateService);
  private errorHandler = inject(ErrorHandlerService);
  toast = inject(ToastService);
  providerUtils = inject(ProviderUtils);
  router = inject(Router);
  route = inject(ActivatedRoute);

  connectionFormService = inject(ConnectionFormService);
  private cdr = inject(ChangeDetectorRef);

  editingId: string | null = null;
  isEditing = signal(false);

  provider: ProviderType = "json";
  formData = signal<ConnectionFormData>({
    name: "",
    path: "",
    host: "",
    port: "",
    username: "",
    password: "",
    database: "",
    useSsl: false,
  });

  testResult = signal<ConnectionHealth | null>(null);
  testing = signal(false);
  saving = signal(false);

  constructor() {
    effect(() => {
      const isOpen = this.connectionFormService.isOpen();
      const editId = this.connectionFormService.editingId();
      const isDup = this.connectionFormService.isDuplicate();

      if (isOpen) {
        if (editId) {
          this.editingId = editId;
          this.isEditing.set(true);
          this.loadConnectionForEdit(editId);
        } else {
          this.editingId = null;
          this.isEditing.set(false);
          this.resetForm();
        }
        if (isDup && editId) {
          this.loadConnectionForDuplicate(editId);
        }
      }
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get("id");
    if (id && id !== "new") {
      this.connectionFormService.openForEdit(id);
    }

    const duplicateId = this.route.snapshot.queryParamMap.get("duplicate");
    if (duplicateId) {
      this.connectionFormService.openForDuplicate(duplicateId);
    }
  }

  ngOnDestroy() {}

  private resetForm() {
    this.provider = "json";
    this.formData.set({
      name: "",
      path: "",
      host: "",
      port: "",
      username: "",
      password: "",
      database: "",
      useSsl: false,
    });
    this.testResult.set(null);
  }

  openNew() {
    this.connectionFormService.openNew();
  }

  openForEdit(id: string) {
    this.connectionFormService.openForEdit(id);
  }

  openForDuplicate(id: string) {
    this.connectionFormService.openForDuplicate(id);
  }

  onClose() {
    this.closed.emit();
    this.connectionFormService.close();
  }

  private async loadConnectionForEdit(id: string) {
    try {
      const conn = await this.store.getFullConnection(id);
      this.editingId = id;
      const innerConfig = conn.config.config;

      if (!innerConfig || !innerConfig.type) {
        this.errorHandler.handleError(new Error("Invalid connection config"), "Loading connection");
        return;
      }

      const validTypes = ["Json", "Mongo", "Redis", "Postgres", "Sqlite", "MySql"];
      if (!validTypes.includes(innerConfig.type)) {
        this.errorHandler.handleError(
          new Error(`Unknown provider type: ${innerConfig.type}`),
          "Loading connection"
        );
        return;
      }

      this.provider = this.providerUtils.toProviderType(innerConfig.type);
      const parsed = parseProviderConfig(innerConfig);
      this.formData.set({
        name: conn.config.name || "",
        path: parsed.path || "",
        host: parsed.host || "",
        port: parsed.port || "",
        username: parsed.username || "",
        password: parsed.password || "",
        database: parsed.database || "",
        useSsl: false,
      });
    } catch (e) {
      this.errorHandler.handleError(e, "Loading connection for edit");
    }
  }

  private async loadConnectionForDuplicate(id: string) {
    try {
      const conn = await this.store.getFullConnection(id);
      const innerConfig = conn.config.config;

      if (!innerConfig || !innerConfig.type) {
        this.errorHandler.handleError(
          new Error("Invalid connection config"),
          "Duplicating connection"
        );
        return;
      }

      const validTypes = ["Json", "Mongo", "Redis", "Postgres", "Sqlite", "MySql"];
      if (!validTypes.includes(innerConfig.type)) {
        this.errorHandler.handleError(
          new Error(`Unknown provider type: ${innerConfig.type}`),
          "Duplicating connection"
        );
        return;
      }

      this.provider = this.providerUtils.toProviderType(innerConfig.type);
      const parsed = parseProviderConfig(innerConfig);
      this.formData.set({
        name: (conn.config.name || "") + " (Copy)",
        path: parsed.path || "",
        host: parsed.host || "",
        port: parsed.port || "",
        username: parsed.username || "",
        password: parsed.password || "",
        database: parsed.database || "",
        useSsl: false,
      });
    } catch (e) {
      this.errorHandler.handleError(e, "Loading connection for duplicate");
    }
  }

  onProviderChange(type: ProviderType) {
    this.provider = type;
  }

  onNameChange(name: string) {
    this.formData.update((d) => ({ ...d, name }));
  }

  onFormDataChange(data: ConnectionFormData) {
    this.formData.set(data);
  }

  async onBrowseFile(isDirectory: boolean) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      let filters: { name: string; extensions: string[] }[] = [];
      if (!isDirectory) {
        if (this.provider === "sqlite") {
          filters = [{ name: "SQLite Database", extensions: ["db", "sqlite", "sqlite3"] }];
        } else {
          filters = [{ name: "JSON Database", extensions: ["json"] }];
        }
      }
      const selected = await open({
        multiple: false,
        directory: isDirectory,
        filters,
      });
      if (selected) {
        this.formData.update((d) => ({ ...d, path: selected as string }));
      }
    } catch (e) {
      this.toast.error("Failed to open file dialog");
    }
  }

  isFormValid(): boolean {
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
        return !!data.host.trim() && !!data.port.trim();
      default:
        return false;
    }
  }

  async testConnection() {
    this.testing.set(true);
    this.cdr.markForCheck();
    try {
      const config = this.buildConfig();
      const result = await this.store.testConnection(config);
      this.testResult.set(result);
      this.cdr.markForCheck();
    } catch (e) {
      this.testResult.set({
        healthy: false,
        provider: "",
        server_version: String(e),
        latency_ms: undefined,
      });
      this.cdr.markForCheck();
    } finally {
      this.testing.set(false);
      this.cdr.markForCheck();
    }
  }

  async save() {
    this.saving.set(true);
    this.cdr.markForCheck();
    try {
      const config = this.buildConfig();
      if (this.editingId) {
        await this.store.deleteConnection(this.editingId);
      }
      await this.store.saveConnection(config);
      this.onClose();
    } catch (e) {
      this.errorHandler.handleError(e, "Saving connection");
      this.cdr.markForCheck();
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  private buildConfig(): TestConnectionConfig {
    const data = this.formData();
    const uri = this.buildUriFromFields();

    switch (this.provider) {
      case "json":
        return {
          name: data.name,
          config: {
            type: "Json",
            name: data.name,
            path: data.path,
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
            uri: uri,
            database: data.database,
          },
        };
      case "redis":
        return {
          name: data.name,
          config: {
            type: "Redis",
            name: data.name,
            uri: uri,
          },
        };
      case "postgres":
        return {
          name: data.name,
          config: {
            type: "Postgres",
            name: data.name,
            uri: uri,
          },
        };
      case "mysql":
        return {
          name: data.name,
          config: {
            type: "MySql",
            name: data.name,
            uri: uri,
          },
        };
      default:
        return {
          name: data.name,
          config: {
            type: "MySql",
            name: data.name,
            uri: uri,
          },
        };
    }
  }

  private buildUriFromFields(): string {
    const data = this.formData();
    const host = data.host || "localhost";
    const port = data.port;
    const user = data.username;
    const pass = data.password;
    const db = data.database;

    switch (this.provider) {
      case "mongo":
        const mongoAuth = user && pass ? `${user}:${pass}@` : "";
        const mongoDb = db ? `/${db}` : "";
        return `mongodb://${mongoAuth}${host}:${port}${mongoDb}`;
      case "postgres":
        const pgAuth = user && pass ? `${user}:${pass}@` : "";
        return `postgres://${pgAuth}${host}:${port}/${db || "postgres"}`;
      case "mysql":
        const mysqlAuth = user && pass ? `${user}:${pass}@` : "";
        return `mysql://${mysqlAuth}${host}:${port}/${db || ""}`;
      case "redis":
        return `redis://${host}:${port}`;
      default:
        return "";
    }
  }

  cancel() {
    this.onClose();
  }
}
