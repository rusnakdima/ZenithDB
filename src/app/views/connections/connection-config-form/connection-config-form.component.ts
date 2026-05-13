import { Component, input, output, signal, OnInit, OnChanges, SimpleChanges } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { ProviderType } from "@shared/models/provider.model";

export interface ConnectionFormData {
  name: string;
  path: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  behavior: string;
  useSsl: boolean;
}

@Component({
  selector: "app-connection-config-form",
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: "./connection-config-form.component.html",
})
export class ConnectionConfigFormComponent implements OnInit, OnChanges {
  provider = input.required<ProviderType>();
  initialData = input<ConnectionFormData>({
    name: "",
    path: "",
    host: "",
    port: "",
    username: "",
    password: "",
    database: "",
    behavior: "folders_as_databases",
    useSsl: false,
  });

  browseFile = output<boolean>();
  dataChange = output<ConnectionFormData>();

  data: ConnectionFormData = {
    name: "",
    path: "",
    host: "",
    port: "",
    username: "",
    password: "",
    database: "",
    behavior: "folders_as_databases",
    useSsl: false,
  };

  private isFirstInit = true;

  ngOnInit() {
    this.data = { ...this.initialData() };
    this.isFirstInit = false;
    if (!this.data.host && !this.data.path) {
      this.setDefaultsForProvider();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["provider"] && !this.isFirstInit) {
      this.resetDataForProvider();
    }
  }

  private resetDataForProvider(): void {
    this.data = {
      name: this.data.name,
      path: "",
      host: "",
      port: "",
      username: "",
      password: "",
      database: "",
      behavior: "folders_as_databases",
      useSsl: false,
    };
    this.setDefaultsForProvider();
  }

  setDefaultsForProvider(): void {
    switch (this.provider()) {
      case "mongo":
        this.data.host = "localhost";
        this.data.port = "27017";
        break;
      case "postgres":
        this.data.host = "localhost";
        this.data.port = "5432";
        break;
      case "mysql":
        this.data.host = "localhost";
        this.data.port = "3306";
        break;
      case "redis":
        this.data.host = "localhost";
        this.data.port = "6379";
        break;
    }
    this.emitChange();
  }

  onFieldChange(): void {
    this.emitChange();
  }

  private emitChange(): void {
    this.dataChange.emit({ ...this.data });
  }

  isValid(): boolean {
    if (!this.data.name.trim()) return false;
    switch (this.provider()) {
      case "json":
      case "sqlite":
        return !!this.data.path.trim();
      case "mongo":
      case "postgres":
      case "mysql":
      case "redis":
        return !!this.data.host.trim() && !!this.data.port.trim();
      default:
        return false;
    }
  }
}
