import { Component, inject, signal, computed, effect } from "@angular/core";
import { Router, RouterLink, ActivatedRoute, NavigationEnd } from "@angular/router";
import { filter, map } from "rxjs/operators";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ThemeService } from "@shared/services/theme.service";
import { DialogService } from "@shared/services/dialog.service";
import { SettingsDialogComponent } from "@shared/components/settings-dialog/settings-dialog.component";
import { toSignal } from "@angular/core/rxjs-interop";

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

  private routerUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  showExplorerBreadcrumb = computed(
    () =>
      !!this.connectionState.activeConnectionName() &&
      (this.routerUrl().includes("/schema") ||
        this.routerUrl().includes("/query") ||
        this.routerUrl().includes("/explorer") ||
        this.routerUrl().includes("/data/"))
  );

  tabs = [
    { id: "gallery" as const, label: "Gallery", route: "/connections" },
    { id: "explorer" as const, label: "Explorer", route: "/schema" },
    { id: "workbench" as const, label: "Workbench", route: "/query" },
  ];

  isDarkMode = computed(() => this.themeService.isDarkMode());

  activeTab = computed<"gallery" | "explorer" | "workbench">(() => {
    const url = this.routerUrl();
    if (url.includes("/connections") || url === "/") {
      return "gallery";
    } else if (url.includes("/schema")) {
      return "explorer";
    } else if (url.includes("/query")) {
      return "workbench";
    }
    return "gallery";
  });

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
