import { Component, ChangeDetectionStrategy, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { FormsModule } from "@angular/forms";
import { SettingsService } from "../../shared/services/settings.service";
import { ThemeService } from "@shared/services/theme.service";
import { ThemePreset, THEME_PRESETS } from "@shared/models/theme.model";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { AppLoggerService } from "@shared/services/app-logger.service";

interface ThemeOption {
  value: "dark" | "light" | "system";
  label: string;
  icon: string;
}

@Component({
  selector: "app-settings",
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  templateUrl: "./settings.view.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private settingsService = inject(SettingsService);
  private themeService = inject(ThemeService);
  private dataflowLogger = inject(DataflowLoggerService);
  private logger = inject(AppLoggerService);

  private readonly page = "Settings";

  settings = this.settingsService.settings;
  themePresets = THEME_PRESETS;

  themeOptions: ThemeOption[] = [
    { value: "dark", label: "Dark", icon: "dark_mode" },
    { value: "light", label: "Light", icon: "light_mode" },
    { value: "system", label: "System", icon: "settings_suggest" },
  ];

  selectPreset(preset: ThemePreset): void {
    this.logger.log("[SETTINGS]", "User action: selectPreset", { preset: preset.name });
    this.themeService.setPreset(preset);
  }

  updateGeneral(partial: Record<string, unknown>): void {
    this.logger.log("[SETTINGS]", "User action: updateGeneral", partial);
    this.settingsService.updateGeneral(partial as any);
    if (partial["theme"]) {
      this.themeService.setTheme(partial["theme"] as "dark" | "light");
    }
  }

  updateEditor(partial: Record<string, unknown>): void {
    this.logger.log("[SETTINGS]", "User action: updateEditor", partial);
    this.settingsService.updateEditor(partial as any);
  }

  updateData(partial: Record<string, unknown>): void {
    this.logger.log("[SETTINGS]", "User action: updateData", partial);
    this.settingsService.updateData(partial as any);
  }

  updateConnections(partial: Record<string, unknown>): void {
    this.logger.log("[SETTINGS]", "User action: updateConnections", partial);
    this.settingsService.updateConnections(partial as any);
  }

  resetToDefaults(): void {
    this.logger.log("[SETTINGS]", "User action: resetToDefaults");
    this.settingsService.resetToDefaults();
  }
}
