import {
  Component,
  input,
  output,
  signal,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { ProviderType } from "@shared/models/provider.model";
import { AppLoggerService } from "@shared/services/app-logger.service";

export interface ConnectionFormData {
  name: string;
  path: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  useSsl: boolean;
}

@Component({
  selector: "app-connection-config-form",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatIconModule],
  templateUrl: "./connection-config-form.component.html",
})
export class ConnectionConfigFormComponent implements OnInit, OnChanges {
  private logger = inject(AppLoggerService);

  provider = input.required<ProviderType>();
  initialData = input<ConnectionFormData>({
    name: "",
    path: "",
    host: "",
    port: "",
    username: "",
    password: "",
    database: "",
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
    useSsl: false,
  };

  private isFirstInit = true;

  ngOnInit() {
    this.data = { ...this.initialData() };
    this.isFirstInit = false;
    if (!this.data.host && !this.data.path) {
      this.setDefaultsForProvider();
    }
    this.logger.debug("[CONNECTION_CONFIG_FORM]", "Initialized", { provider: this.provider() });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["initialData"] && !this.isFirstInit) {
      const newData = this.initialData();
      this.data = {
        ...this.data,
        name: newData.name,
        path: newData.path,
        host: newData.host,
        port: newData.port,
        username: newData.username,
        password: newData.password,
        database: newData.database,
        useSsl: newData.useSsl,
      };
      this.logger.debug("[CONNECTION_CONFIG_FORM]", "Initial data changed", {
        provider: this.provider(),
      });
    } else if (changes["provider"] && !this.isFirstInit) {
      this.logger.debug("[CONNECTION_CONFIG_FORM]", "Provider changed", {
        provider: this.provider(),
      });
      this.resetDataForProvider();
    }
  }

  private resetDataForProvider(): void {
    const currentName = this.data.name;
    this.data = {
      name: currentName,
      path: "",
      host: "",
      port: "",
      username: "",
      password: "",
      database: "",
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
