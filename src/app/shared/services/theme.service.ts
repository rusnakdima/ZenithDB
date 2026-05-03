import { Injectable, signal, effect, Inject, PLATFORM_ID } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";

@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly STORAGE_KEY = "zenithdb-theme";

  isDarkMode = signal(true);

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
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
    localStorage.setItem(this.STORAGE_KEY, dark ? "dark" : "light");
  }

  getSystemPreference(): boolean {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  toggle(): void {
    this.isDarkMode.update((v) => !v);
  }
}
