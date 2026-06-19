import { CommonModule } from "@angular/common";
import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  ChangeDetectionStrategy,
  inject,
} from "@angular/core";
import { NavigationEnd, Router, RouterModule } from "@angular/router";
import { filter, Subscription } from "rxjs";

import { MatIconModule } from "@angular/material/icon";

import { FloatingNavItem, NavRouteConfig } from "./floating-bottom-nav.entity";

@Component({
  selector: "app-floating-bottom-nav",
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: "./floating-bottom-nav.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingBottomNavComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private routerSub?: Subscription;

  url = signal("");

  get listNavs(): Array<FloatingNavItem> {
    return [
      {
        url: "/connections",
        icon: "link",
        label: "Connections",
        childRoutes: [
          { pattern: /^\/connections$/, icon: "link", label: "Connections" },
          { pattern: /^\/connections\/new$/, icon: "add", label: "New" },
          { pattern: /^\/connections\/[^/]+$/, icon: "storage", label: "Detail" },
          { pattern: /^\/connections\/[^/]+\/edit$/, icon: "edit", label: "Edit" },
          { pattern: /^\/connections\/[^/]+\/[^/]+$/, icon: "storage", label: "Database" },
          {
            pattern: /^\/connections\/[^/]+\/[^/]+\/explorer/,
            icon: "explore",
            label: "Explorer",
          },
        ],
      },
      {
        url: "/query",
        icon: "code",
        label: "Query",
        childRoutes: [{ pattern: /^\/query$/, icon: "code", label: "Query" }],
      },
      { url: "/settings", icon: "settings", label: "Settings" },
    ];
  }

  getLabel(nav: FloatingNavItem): string {
    if (nav.childRoutes) {
      const match = this.findRouteMatch(nav.childRoutes);
      return match?.label ?? nav.label;
    }
    return nav.label;
  }

  getIcon(nav: FloatingNavItem): string {
    if (nav.childRoutes) {
      const match = this.findRouteMatch(nav.childRoutes);
      return match?.icon ?? nav.icon;
    }
    return nav.icon;
  }

  private findRouteMatch(routes: NavRouteConfig[]): NavRouteConfig | undefined {
    return routes.find((r) => r.pattern.test(this.url()));
  }

  isActiveRoute(nav: FloatingNavItem): boolean {
    if (this.url() === nav.url) return true;
    if (nav.childRoutes) {
      return this.findRouteMatch(nav.childRoutes) !== undefined;
    }
    return false;
  }

  ngOnInit(): void {
    this.url.set(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((_val) => {
        this.url.set(this.router.url);
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }
}
