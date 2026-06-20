import {
  Component,
  signal,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  OnDestroy,
} from "@angular/core";
import { CommonModule, Location } from "@angular/common";
import { Router, NavigationEnd, RouterModule } from "@angular/router";
import { filter, Subscription } from "rxjs";
import { MatIconModule } from "@angular/material/icon";
import { ThemeService } from "@shared/services/theme.service";
import { ConnectionStateService } from "@services/services.connection-state.service";

interface Breadcrumb {
  label: string;
  url: string;
}

@Component({
  selector: "app-header",
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: "./header.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private locationService = inject(Location);
  private themeService = inject(ThemeService);
  private connectionState = inject(ConnectionStateService);
  private routerSub?: Subscription;

  pageTitle = signal("ZenithDB");
  breadcrumbs = signal<Breadcrumb[]>([]);
  historyLength = signal(0);

  ngOnInit(): void {
    this.historyLength.set(window.history.length);
    this.updateFromRoute(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((event) => {
        this.historyLength.set(window.history.length);
        this.updateFromRoute(event.urlAfterRedirects);
      });
  }

  private formatSegment(segment: string, index: number, segments: string[]): string {
    if (!segment) return "";

    if (segment === "explorer") {
      return "Explorer";
    }

    if (segment.length === 36 && segment.includes("-")) {
      if (segments[index - 1] === "connections") {
        return this.connectionState.activeConnectionName() || "Connection";
      }
      return "Details";
    }

    if (index === 2 && segments[0] === "connections") {
      return this.connectionState.activeDatabaseName() || "Database";
    }

    if (/^\d+$/.test(segment)) {
      return "Item " + segment;
    }

    return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
  }

  private updateFromRoute(url: string): void {
    const [pathOnly] = url.split("?");
    const segments = pathOnly.split("/").filter(Boolean);
    const crumbs: Breadcrumb[] = [];
    let currentUrl = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentUrl += "/" + segment;

      if (i === 0 && segments.length > 1) {
        crumbs.push({ label: "Connections", url: "/connections" });
        continue;
      }

      const label = this.formatSegment(segment, i, segments);
      if (label) {
        crumbs.push({ label, url: currentUrl });
      }
    }

    const basePath = "/" + (segments[0] || "");
    let title = "ZenithDB";

    if (basePath === "/connections") {
      title =
        segments.length > 1
          ? this.connectionState.activeConnectionName() || "Connection"
          : "Connections";
    } else if (basePath === "/query") {
      title = "Query";
    } else if (basePath === "/settings") {
      title = "Settings";
    }

    if (url.includes("/explorer")) {
      title = "Explorer";
    }

    this.pageTitle.set(title);
    this.breadcrumbs.set(crumbs);
  }

  goBack(): void {
    this.locationService.back();
  }

  navigateTo(url: string): void {
    this.router.navigateByUrl(url);
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }
}
