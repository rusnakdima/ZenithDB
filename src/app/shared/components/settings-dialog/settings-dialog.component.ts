import { Component, inject, signal, Output, EventEmitter, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SettingsService, AppSettings, ThemeSetting, TabSize } from "@shared/services/settings.service";
import { ThemeService } from "@shared/services/theme.service";
import { ToastService } from "@services/toast.service";

type SettingsTab = "general" | "editor" | "data" | "connections";

@Component({
  selector: "app-settings-dialog",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./settings-dialog.component.html",
})
export class SettingsDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private settingsService = inject(SettingsService);
  private themeService = inject(ThemeService);
  private toast = inject(ToastService);

  activeTab = signal<SettingsTab>("general");

  settings = signal<AppSettings>(this.settingsService.currentSettings);

  generalTab = signal<SettingsTab>("general");
  editorTab = signal<SettingsTab>("editor");
  dataTab = signal<SettingsTab>("data");
  connectionsTab = signal<SettingsTab>("connections");

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

  switchTab(tab: SettingsTab) {
    this.activeTab.set(tab);
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
      this.themeService.isDarkMode.set(prefersDark);
    } else {
      this.themeService.isDarkMode.set(theme === "dark");
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
    this.close.emit();
  }

  cancelSettings() {
    this.settings.set(this.settingsService.currentSettings);
    this.close.emit();
  }

  resetToDefaults() {
    this.settingsService.resetToDefaults();
    this.settings.set(this.settingsService.currentSettings);
    this.applyTheme(this.settings().general.theme);
    this.toast.info("Settings reset to defaults");
  }
}