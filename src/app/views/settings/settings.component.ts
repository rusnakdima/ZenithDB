import { Component, ChangeDetectionStrategy, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { FormsModule } from "@angular/forms";
import { SettingsService } from "../../shared/services/settings.service";

@Component({
  selector: "app-settings",
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  templateUrl: "./settings.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private settingsService = inject(SettingsService);

  settings = this.settingsService.settings;

  updateGeneral(partial: Record<string, unknown>): void {
    this.settingsService.updateGeneral(partial as any);
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
