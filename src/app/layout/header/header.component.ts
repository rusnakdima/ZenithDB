import { Component, inject, computed } from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";
import { filter, map } from "rxjs/operators";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ThemeService } from "@shared/services/theme.service";
import { toSignal } from "@angular/core/rxjs-interop";

@Component({
  selector: "app-header",
  standalone: true,
  imports: [MatIconModule],
  templateUrl: "./header.component.html",
})
export class HeaderComponent {
  connectionState = inject(ConnectionStateService);
  themeService = inject(ThemeService);
  router = inject(Router);

  private routerUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  private getUrlSegments(url: string): string[] {
    return url.split("/").filter((s) => s);
  }

  showExplorerBreadcrumb = computed(() => {
    const segments = this.getUrlSegments(this.routerUrl());
    return (
      !!this.connectionState.activeConnectionName() &&
      (segments[0] === "schema" ||
        segments[0] === "query" ||
        segments[0] === "explorer" ||
        segments[0] === "data")
    );
  });

  isDarkMode = computed(() => this.themeService.isDarkMode());

  goHome() {
    this.router.navigate(["/connections"]);
  }

  getCurrentBreadcrumb(): string {
    const segments = this.getUrlSegments(this.routerUrl());
    const first = segments[0];
    if (first === "connections") {
      if (segments[1] === "new") return "New Connection";
      return "Dashboard";
    } else if (first === "schema") {
      return "Explorer";
    } else if (first === "query") {
      return "Workbench";
    }
    return "Dashboard";
  }
}
