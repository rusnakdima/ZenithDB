import {
  Component,
  inject,
  computed,
  signal,
  ElementRef,
  viewChild,
  OnDestroy,
} from "@angular/core";
import { Router, NavigationEnd } from "@angular/router";
import { filter, map } from "rxjs/operators";
import { MatIconModule } from "@angular/material/icon";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ThemeService } from "@shared/services/theme.service";
import { DatabaseService } from "@shared/services/database.service";
import { DataStoreService } from "@services/core/data-store.service";
import { toSignal } from "@angular/core/rxjs-interop";

export interface Breadcrumb {
  label: string;
  route: string | null;
  isLast: boolean;
}

@Component({
  selector: "app-header",
  standalone: true,
  imports: [MatIconModule],
  templateUrl: "./header.component.html",
})
export class HeaderComponent implements OnDestroy {
  connectionState = inject(ConnectionStateService);
  themeService = inject(ThemeService);
  router = inject(Router);
  private databaseService = inject(DatabaseService);
  private dataStore = inject(DataStoreService);

  private searchInputRef = viewChild<ElementRef<HTMLInputElement>>("searchInput");

  private routerUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  searchQuery = signal("");
  searchResults = signal<Array<{ name: string; count: number }>>([]);
  isSearching = signal(false);
  selectedIndex = signal(-1);

  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private getUrlSegments(url: string): string[] {
    return url.split("/").filter((s) => s);
  }

  getBreadcrumbs(): Breadcrumb[] {
    const url = this.routerUrl() || "";
    const segments = this.getUrlSegments(url);
    const breadcrumbs: Breadcrumb[] = [];

    if (segments.length === 0 || (segments.length === 1 && segments[0] === "connections")) {
      return [{ label: "Connections", route: null, isLast: true }];
    }

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLast = i === segments.length - 1;

      if (segment === "connections") {
        if (segments[i + 1] === "new") {
          breadcrumbs.push({ label: "Connections", route: "/connections", isLast: false });
          breadcrumbs.push({ label: "New Connection", route: "/connections/new", isLast: true });
          break;
        } else if (segments[i + 1]) {
          const connId = segments[i + 1];
          const connName = this.getConnectionName(connId);
          if (segments[i + 2] === "explorer") {
            breadcrumbs.push({ label: "Connections", route: "/connections", isLast: false });
            breadcrumbs.push({ label: connName, route: `/connections/${connId}`, isLast: false });
            breadcrumbs.push({ label: "Explorer", route: null, isLast: true });
            break;
          } else {
            breadcrumbs.push({ label: "Connections", route: "/connections", isLast: false });
            breadcrumbs.push({ label: connName, route: null, isLast: true });
            break;
          }
        } else {
          breadcrumbs.push({ label: "Connections", route: null, isLast: true });
        }
      } else if (segment === "query") {
        breadcrumbs.push({ label: "Workbench", route: "/query", isLast: true });
      }
    }

    if (breadcrumbs.length === 0) {
      return [{ label: "Connections", route: null, isLast: true }];
    }

    return breadcrumbs;
  }

  private getConnectionName(connId: string): string {
    const conn = this.dataStore.getConnections().find((c) => c.id === connId);
    return conn?.name || connId;
  }

  navigateToBreadcrumb(route: string | null): void {
    if (route) {
      this.router.navigate([route]);
    }
  }

  showExplorerBreadcrumb = computed(() => {
    const segments = this.getUrlSegments(this.routerUrl() || "");
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

  async onSearchInput(event: Event): Promise<void> {
    const query = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.searchQuery.set(query);
    this.selectedIndex.set(-1);

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    if (!query) {
      this.searchResults.set([]);
      this.isSearching.set(false);
      return;
    }

    this.searchDebounceTimer = setTimeout(async () => {
      this.isSearching.set(true);

      let collections = this.dataStore.getCollections() || [];
      if (collections.length === 0) {
        try {
          const result = await this.databaseService.listCollections();
          collections = result || [];
        } catch {
          collections = [];
        }
      }

      const filtered = collections.filter((c) => c.name.toLowerCase().includes(query)).slice(0, 10);
      this.searchResults.set(filtered);
    }, 300);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const results = this.searchResults();
    if (results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.selectedIndex.update((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this.selectedIndex.update((i) => Math.max(i - 1, -1));
    } else if (event.key === "Enter" && this.selectedIndex() >= 0) {
      event.preventDefault();
      this.navigateToCollection(results[this.selectedIndex()].name);
    } else if (event.key === "Escape") {
      this.clearSearch();
    }
  }

  navigateToCollection(name: string): void {
    const connId = this.connectionState.activeConnectionId();
    if (connId) {
      this.router.navigate(["/connections", connId, "explorer"], {
        queryParams: { collection: name },
      });
    }
    this.clearSearch();
  }

  clearSearch(): void {
    this.searchQuery.set("");
    this.searchResults.set([]);
    this.isSearching.set(false);
    this.selectedIndex.set(-1);
    this.searchInputRef()?.nativeElement?.blur();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }
}
