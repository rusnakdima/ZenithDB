import { Component, inject, input, signal, output, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { TabGroupComponent, TabItem } from "@shared/components/tab-group/tab-group.component";
import { CheckboxComponent } from "@shared/components/checkbox/checkbox.component";
import {
  SettingsService,
  AppSettings,
  ThemeSetting,
  TabSize,
} from "@shared/services/settings.service";
import { ThemeService } from "@shared/services/theme.service";
import { ToastService } from "@services/toast.service";

type SettingsTab = "general" | "editor" | "data" | "connections";

@Component({
  selector: "app-settings-dialog",
  standalone: true,
  imports: [FormsModule, ModalComponent, TabGroupComponent, CheckboxComponent],
  templateUrl: "./settings-dialog.component.html",
})
export class SettingsDialogComponent implements OnInit {
  open = input<boolean>(false);
  closed = output<void>();

  private settingsService = inject(SettingsService);
  private themeService = inject(ThemeService);
  private toast = inject(ToastService);

  activeTab = signal<SettingsTab>("general");

  settings = signal<AppSettings>(this.settingsService.currentSettings);

  tabs: TabItem[] = [
    { id: "general", label: "General" },
    { id: "editor", label: "Editor" },
    { id: "data", label: "Data" },
    { id: "connections", label: "Connections" },
  ];

  themeOptions: { value: ThemeSetting; label: string }[] = [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
    { value: "system", label: "System" },
  ];

  tabSizeOptions: TabSize[] = [2, 4, 8];
  pageSizeOptions = [10, 25, 50, 100];

  ngOnInit() {
    this.settings.set(this.settingsService.currentSettings);
  }

  get currentSettings(): AppSettings {
    return this.settings();
  }

  switchTab(tab: string) {
    this.activeTab.set(tab as SettingsTab);
  }

  updateGeneralTheme(theme: ThemeSetting) {
    this.settings.update((s) => ({
      ...s,
      general: { ...s.general, theme },
    }));
    this.applyTheme(theme);
  }

  private applyTheme(theme: ThemeSetting) {
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.themeService.toggle(); // This will sync with settings service
    } else {
      // Update settings service to reflect the theme change
      this.settingsService.updateGeneral({ theme });
    }
  }

  updateGeneral(partial: Partial<AppSettings["general"]>) {
    this.settings.update((s) => ({
      ...s,
      general: { ...s.general, ...partial },
    }));
  }

  updateEditor(partial: Partial<AppSettings["editor"]>) {
    this.settings.update((s) => ({
      ...s,
      editor: { ...s.editor, ...partial },
    }));
  }

  updateData(partial: Partial<AppSettings["data"]>) {
    this.settings.update((s) => ({
      ...s,
      data: { ...s.data, ...partial },
    }));
  }

  updateConnections(partial: Partial<AppSettings["connections"]>) {
    this.settings.update((s) => ({
      ...s,
      connections: { ...s.connections, ...partial },
    }));
  }

  checkForUpdates() {
    this.toast.info("Checking for updates...");
    setTimeout(() => {
      this.toast.success("You're using the latest version!");
    }, 1000);
  }

  saveSettings() {
    const current = this.settings();
    this.settingsService.updateSettings(current);
    this.toast.success("Settings saved");
    this.closed.emit();
  }

  cancelSettings() {
    this.settings.set(this.settingsService.currentSettings);
    this.closed.emit();
  }

  resetToDefaults() {
    this.settingsService.resetToDefaults();
    this.settings.set(this.settingsService.currentSettings);
    this.applyTheme(this.settings().general.theme);
    this.toast.info("Settings reset to defaults");
  }
}
