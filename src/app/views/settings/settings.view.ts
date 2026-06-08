import { Component, ChangeDetectionStrategy, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { FormsModule } from "@angular/forms";
import { SettingsService } from "../../shared/services/settings.service";
import { ThemeService } from "@shared/services/theme.service";
import { ThemePreset, THEME_PRESETS } from "@shared/models/theme.model";

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

  settings = this.settingsService.settings;
  themePresets = THEME_PRESETS;

  themeOptions: ThemeOption[] = [
    { value: "dark", label: "Dark", icon: "dark_mode" },
    { value: "light", label: "Light", icon: "light_mode" },
    { value: "system", label: "System", icon: "settings_suggest" },
  ];

  selectPreset(preset: ThemePreset): void {
    this.themeService.setPreset(preset);
  }

  updateGeneral(partial: Record<string, unknown>): void {
    this.settingsService.updateGeneral(partial as any);
    if (partial["theme"]) {
      this.themeService.setTheme(partial["theme"] as "dark" | "light");
    }
  }

  updateEditor(partial: Record<string, unknown>): void {
    this.settingsService.updateEditor(partial as any);
  }

  updateData(partial: Record<string, unknown>): void {
    this.settingsService.updateData(partial as any);
  }

  updateConnections(partial: Record<string, unknown>): void {
    this.settingsService.updateConnections(partial as any);
  }

  resetToDefaults(): void {
    this.settingsService.resetToDefaults();
  }
}
