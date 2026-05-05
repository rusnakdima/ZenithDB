import { Component, inject, signal, HostBinding, OnInit } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { CommonModule } from "@angular/common";
import { CommandPaletteComponent } from "@shared/components/command-palette/command-palette.component";
import { LoadingOverlayComponent } from "@shared/components/loading/loading-overlay.component";
import { ToastContainerComponent } from "@components/toast/toast-container.component";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { KeyboardShortcutsService } from "@shared/services/keyboard-shortcuts.service";
import { ShortcutsHelpDialogComponent } from "@shared/components/shortcuts-help-dialog/shortcuts-help-dialog.component";
import { DialogService } from "@shared/services/dialog.service";
import { SidebarComponent } from "@layout/sidebar/sidebar.component";
import { ThemeService } from "@shared/services/theme.service";
import { MatIconModule } from "@angular/material/icon";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router, NavigationEnd } from "@angular/router";
import { filter, map } from "rxjs/operators";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    CommandPaletteComponent,
    LoadingOverlayComponent,
    ToastContainerComponent,
    ShortcutsHelpDialogComponent,
    SidebarComponent,
    MatIconModule,
  ],
  templateUrl: "./app.html",
})
export class AppComponent implements OnInit {
  connectionState = inject(ConnectionStateService);
  shortcutsService = inject(KeyboardShortcutsService);
  dialogService = inject(DialogService);
  themeService = inject(ThemeService);
  router = inject(Router);

  private routerUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  @HostBinding("class.dark")
  get darkMode(): boolean {
    return this.themeService.isDarkMode();
  }

  @HostBinding("class.light")
  get lightMode(): boolean {
    return !this.themeService.isDarkMode();
  }

  getCurrentBreadcrumb(): string {
    const url = this.routerUrl();
    if (url.includes("/connections/new")) {
      return "New Connection";
    } else if (url.includes("/connections") || url === "/") {
      return "Dashboard";
    } else if (url.includes("/schema")) {
      return "Explorer";
    } else if (url.includes("/query")) {
      return "Workbench";
    }
    return "Dashboard";
  }

  ngOnInit(): void {
    this.themeService.initFromSettings();

    document.addEventListener("zenith:toggle-theme", () => {
      this.themeService.toggle();
    });

    document.addEventListener("zenith:toggle-command-palette", () => {
      document.querySelector("app-command-palette")?.setAttribute("data-toggle", "");
    });

    document.addEventListener("zenith:close-top-modal", () => {
      this.shortcutsService.shortcutsHelpVisible.set(false);
    });
  }
}
