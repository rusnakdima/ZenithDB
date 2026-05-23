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

import { FloatingNavItem } from "./floating-bottom-nav.model";

@Component({
  selector: "app-floating-bottom-nav",
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: "./floating-bottom-nav.component.html",
  styleUrl: "./floating-bottom-nav.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingBottomNavComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private routerSub?: Subscription;

  url = signal("");

  get listNavs(): Array<FloatingNavItem> {
    return [
      { url: "/connections", icon: "link", label: "Connections" },
      { url: "/query", icon: "code", label: "Query" },
      { url: "/settings", icon: "settings", label: "Settings" },
    ];
  }

  isActiveRoute(nav: FloatingNavItem): boolean {
    return this.url() === nav.url;
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
