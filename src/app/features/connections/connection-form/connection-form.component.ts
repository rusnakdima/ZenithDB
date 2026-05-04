import { Component, inject, signal, computed } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionConfig, ConnectionHealth } from "@shared/models/connection.config";
import { FormValidationService, FieldValidator } from "@shared/services/form-validation.service";

type ProviderType = "json" | "mongo" | "redis" | "postgres" | "sqlite" | "mysql";

@Component({
  selector: "app-connection-form",
  standalone: true,
  imports: [RouterLink, FormsModule, MatIconModule],
  templateUrl: "./connection-form.component.html",
})
export class ConnectionFormComponent {
  private db = inject(DatabaseService);
  private validation = inject(FormValidationService);
  router = inject(Router);

  provider: ProviderType = "json";
  name = "";
  path = "";
  uri = "";
  database = "";
  port = "";
  username = "";
  password = "";

  testResult = signal<ConnectionHealth | null>(null);
  testing = signal(false);

  validators = this.createValidators();

  isFormValid = computed(() => {
    const v = this.validators;
    const nameValid = v.name.isValid();
    const uriValid = v.uri.isValid();
    const pathValid = v.path.isValid();

    const needsUri = ["mongo", "redis", "postgres", "mysql"].includes(this.provider);
    const needsPath = ["json", "sqlite"].includes(this.provider);

    if (needsUri && needsPath) {
      return nameValid && uriValid && pathValid;
    } else if (needsUri) {
      return nameValid && uriValid;
    } else if (needsPath) {
      return nameValid && pathValid;
    }
    return nameValid;
  });

  private createValidators() {
    return {
      provider: this.validation.createFieldValidator([
        this.validation.required("Provider is required"),
      ]),
      name: this.validation.createFieldValidator([
        this.validation.required("Connection name is required"),
        this.validation.minLength(1),
        this.validation.maxLength(100),
      ]),
      uri: this.validation.createFieldValidator([
        this.validation.required("URI is required"),
        this.validation.custom(
          (v) => !v || /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v),
          "Invalid URI format"
        ),
      ]),
      path: this.validation.createFieldValidator([
        this.validation.required("File path is required"),
      ]),
      port: this.validation.createFieldValidator([
        this.validation.custom(
          (v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 65535),
          "Port must be 1-65535"
        ),
      ]),
      username: this.validation.createFieldValidator([
        this.validation.pattern(/^[a-zA-Z0-9_]*$/, "Username must be alphanumeric or underscore"),
      ]),
      password: this.validation.createFieldValidator([
        this.validation.minLength(1, "Password is required"),
      ]),
    };
  }

  validateField(field: "name" | "uri" | "path" | "port" | "username" | "password") {
    const value =
      field === "name"
        ? this.name
        : field === "uri"
          ? this.uri
          : field === "path"
            ? this.path
            : field === "port"
              ? this.port
              : field === "username"
                ? this.username
                : this.password;
    this.validators[field].validate(value);
  }

  touchField(field: "name" | "uri" | "path" | "port" | "username" | "password") {
    this.validators[field].touch();
  }

  getError(field: "name" | "uri" | "path" | "port" | "username" | "password"): string {
    if (!this.validators[field].touched()) return "";
    const errors = this.validators[field].errors();
    const keys = Object.keys(errors);
    return keys.length > 0 ? keys[0] : "";
  }

  showField(field: "uri" | "path" | "port" | "username" | "password" | "database"): boolean {
    switch (field) {
      case "uri":
        return ["mongo", "redis", "postgres", "mysql"].includes(this.provider);
      case "path":
        return ["json", "sqlite"].includes(this.provider);
      case "port":
        return ["postgres", "mysql"].includes(this.provider);
      case "username":
        return ["mongo", "postgres", "mysql"].includes(this.provider);
      case "password":
        return ["mongo", "postgres", "mysql"].includes(this.provider);
      case "database":
        return this.provider === "mongo";
      default:
        return false;
    }
  }

  async testConnection() {
    this.validators.name.touch();
    if (this.showField("uri")) this.validators.uri.touch();
    if (this.showField("path")) this.validators.path.touch();

    if (!this.isFormValid()) return;

    this.testing.set(true);
    this.testResult.set(null);
    try {
      const flatConfig = this.buildConfig();
      const config = {
        name: flatConfig.name,
        config: flatConfig as any,
      };
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
    this.validators.name.touch();
    if (this.showField("uri")) this.validators.uri.touch();
    if (this.showField("path")) this.validators.path.touch();

    if (!this.isFormValid()) return;

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
