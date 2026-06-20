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
import { ProviderUtils } from "@shared/utils/provider.utils";

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
  private providerUtils = inject(ProviderUtils);
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

  getProviderIcon(): string {
    const provider = this.connectionState.activeProvider();
    return provider ? this.providerUtils.getProviderIcon(provider) : "storage";
  }

  getActiveProvider(): string {
    const provider = this.connectionState.activeProvider();
    if (!provider) return "";
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }

  getProviderBadgeClass(): string {
    const provider = this.connectionState.activeProvider();
    if (!provider) return "";
    const colorMap: Record<string, string> = {
      json: "bg-yellow-500/20 text-yellow-500",
      mongo: "bg-green-500/20 text-green-500",
      redis: "bg-red-500/20 text-red-500",
      postgres: "bg-blue-500/20 text-blue-500",
      sqlite: "bg-slate-500/20 text-slate-400",
      mysql: "bg-[var(--accent)]/20 text-[var(--accent)]",
    };
    return colorMap[provider] || "bg-gray-500/20 text-gray-400";
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }
}
