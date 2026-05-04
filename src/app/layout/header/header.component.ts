import { Component, inject, signal, computed, effect } from "@angular/core";
import { Router, RouterLink, ActivatedRoute, NavigationEnd } from "@angular/router";
import { filter } from "rxjs";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ThemeService } from "@shared/services/theme.service";
import { DialogService } from "@shared/services/dialog.service";
import { SettingsDialogComponent } from "@shared/components/settings-dialog/settings-dialog.component";

@Component({
  selector: "app-header",
  standalone: true,
  imports: [RouterLink, MatIconModule],
  templateUrl: "./header.component.html",
})
export class HeaderComponent {
  connectionState = inject(ConnectionStateService);
  themeService = inject(ThemeService);
  private dialogService = inject(DialogService);
  router = inject(Router);

  activeTab = signal<"gallery" | "explorer" | "workbench">("explorer");

  tabs = [
    { id: "gallery" as const, label: "Gallery", route: "/connections" },
    { id: "explorer" as const, label: "Explorer", route: "/schema" },
    { id: "workbench" as const, label: "Workbench", route: "/query" },
  ];

  isDarkMode = computed(() => this.themeService.isDarkMode());

  constructor() {
    effect(
      () => {
        const url = this.router.url;
        if (url.includes("/connections") || url === "/") {
          this.activeTab.set("gallery");
        } else if (url.includes("/schema")) {
          this.activeTab.set("explorer");
        } else if (url.includes("/query")) {
          this.activeTab.set("workbench");
        }
      },
      { allowSignalWrites: true }
    );
  }

  setActiveTab(tabId: "gallery" | "explorer" | "workbench") {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (tab) {
      this.router.navigate([tab.route]);
    }
  }

  goHome() {
    this.router.navigate(["/connections"]);
  }

  toggleTheme() {
    document.dispatchEvent(new CustomEvent("zenith:toggle-theme"));
  }
}
