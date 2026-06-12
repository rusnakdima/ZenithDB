import { Component, input, output, signal, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { ProviderType } from "@shared/models/provider.model";
import { AppLoggerService } from "@shared/services/app-logger.service";

interface ProviderOption {
  type: ProviderType;
  label: string;
  icon: string;
  description: string;
}

@Component({
  selector: "app-provider-selector",
  standalone: true,
  imports: [MatIconModule],
  templateUrl: "./provider-selector.component.html",
})
export class ProviderSelectorComponent {
  private logger = inject(AppLoggerService);

  selected = input<ProviderType | null>(null);

  next = output<void>();
  cancelled = output<void>();
  providerSelected = output<ProviderType>();

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

  selectProvider(type: ProviderType) {
    this.logger.info("[PROVIDER_SELECTOR]", "Provider selected", { type });
    this.providerSelected.emit(type);
  }
}
