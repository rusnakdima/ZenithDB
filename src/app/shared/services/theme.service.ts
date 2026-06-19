import { Injectable, signal, computed, effect, Inject, PLATFORM_ID, inject } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { SettingsService } from "./settings.service";
import { logger } from "@core/services/logger.service";
import { ThemePreset, THEME_PRESETS, getAccentShades, getAccentRgb } from "@app/models/theme.model";

export type ThemeMode = "dark" | "light";

@Injectable({ providedIn: "root" })
export class ThemeService {
  private _themeMode = signal<ThemeMode>("dark");
  private _preset = signal<ThemePreset>(THEME_PRESETS[4]);

  themeMode = this._themeMode.asReadonly();
  preset = this._preset.asReadonly();

  isDarkMode = computed(() => this._themeMode() === "dark");

  accentColor = computed(() => this._preset().accentColor);

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

    const preset = this._preset();
    const shades = getAccentShades(preset.accentColor);
    const rgb = getAccentRgb(preset.accentColor);

    document.documentElement.style.setProperty("--accent", preset.accentColor);
    document.documentElement.style.setProperty("--accent-hover", shades["600"]);
    document.documentElement.style.setProperty("--accent-muted", shades["100"]);

    Object.entries(shades).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--accent-${key}`, value);
    });
    document.documentElement.style.setProperty("--accent-rgb", rgb);

    document.documentElement.setAttribute("data-theme", preset.id);

    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(mode);
  }

  getSystemPreference(): boolean {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  toggle(): void {
    logger.debug("[THEME]", "toggle called");
    const newMode = this._themeMode() === "dark" ? "light" : "dark";
    this._themeMode.set(newMode);
    this.settingsService.updateGeneral({ theme: newMode });
  }

  setTheme(mode: ThemeMode): void {
    logger.debug("[THEME]", "setTheme called", { mode });
    this._themeMode.set(mode);
    this.settingsService.updateGeneral({ theme: mode });
  }

  initFromSettings(): void {
    logger.debug("[THEME]", "initFromSettings started");
    const theme = this.settingsService.currentSettings.general.theme;
    const accentColor = this.settingsService.currentSettings.general.accentColor;

    if (theme === "system") {
      this._themeMode.set(this.getSystemPreference() ? "dark" : "light");
    } else {
      this._themeMode.set(theme as ThemeMode);
    }

    const preset = THEME_PRESETS.find((p) => p.accentColor === accentColor) || THEME_PRESETS[4];
    this._preset.set(preset);
    logger.debug("[THEME]", "initFromSettings completed");
  }

  setPreset(preset: ThemePreset): void {
    logger.debug("[THEME]", "setPreset called", { presetId: preset.id });
    this._preset.set(preset);
    this.settingsService.updateGeneral({ accentColor: preset.accentColor });
  }
}
