import { Injectable, signal, computed, effect, Inject, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { SettingsService } from "./settings.service";

@Injectable({ providedIn: "root" })
export class ThemeService {
  isDarkMode = computed(() => {
    const theme = this.settingsService.currentSettings.general.theme;
    if (theme === "system") {
      return this.getSystemPreference();
    }
    return theme === "dark";
  });

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private settingsService: SettingsService
  ) {
    if (isPlatformBrowser(platformId)) {
      effect(() => {
        this.applyTheme(this.isDarkMode());
      });
    }
  }

  private applyTheme(dark: boolean): void {
    if (typeof document === "undefined") return;
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(dark ? "dark" : "light");
  }

  getSystemPreference(): boolean {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  toggle(): void {
    const currentDark = this.isDarkMode();
    this.settingsService.updateGeneral({ theme: currentDark ? "light" : "dark" });
  }
}
