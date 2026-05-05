import { Injectable, signal, computed, effect, Inject, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { SettingsService } from "./settings.service";

export type ThemeMode = "dark" | "light";

@Injectable({ providedIn: "root" })
export class ThemeService {
  private _themeMode = signal<ThemeMode>("dark");

  themeMode = this._themeMode.asReadonly();

  isDarkMode = computed(() => this._themeMode() === "dark");

  accentColor = computed(() => "var(--accent)");

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private settingsService: SettingsService
  ) {
    if (isPlatformBrowser(platformId)) {
      effect(() => {
        this.applyTheme(this._themeMode());
      });
    }
  }

  private applyTheme(mode: ThemeMode): void {
    if (typeof document === "undefined") return;
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(mode);
  }

  getSystemPreference(): boolean {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  toggle(): void {
    const newMode = this._themeMode() === "dark" ? "light" : "dark";
    this._themeMode.set(newMode);
    this.settingsService.updateGeneral({ theme: newMode });
  }

  setTheme(mode: ThemeMode): void {
    this._themeMode.set(mode);
    this.settingsService.updateGeneral({ theme: mode });
  }

  initFromSettings(): void {
    const theme = this.settingsService.currentSettings.general.theme;
    if (theme === "system") {
      this._themeMode.set(this.getSystemPreference() ? "dark" : "light");
    } else {
      this._themeMode.set(theme as ThemeMode);
    }
  }
}
