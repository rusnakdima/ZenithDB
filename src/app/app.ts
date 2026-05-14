import {
  Component,
  inject,
  signal,
  HostBinding,
  OnInit,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { CommonModule } from "@angular/common";
import { LoadingOverlayComponent } from "@shared/components/loading/loading-overlay.component";
import { ToastContainerComponent } from "@components/toast/toast-container.component";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { KeyboardShortcutsService } from "@shared/services/keyboard-shortcuts.service";
import { ShortcutsHelpDialogComponent } from "@shared/components/shortcuts-help-dialog/shortcuts-help-dialog.component";
import { DialogService } from "@shared/services/dialog.service";
import { SidebarComponent } from "@layout/sidebar/sidebar.component";
import { HeaderComponent } from "@layout/header/header.component";
import { ThemeService } from "@shared/services/theme.service";
import { MatIconModule } from "@angular/material/icon";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router, NavigationEnd } from "@angular/router";
import { filter, map } from "rxjs/operators";
import { ConnectionModalComponent } from "@features/connections/connection-modal/connection-modal.component";
import { ConnectionsApiService } from "@shared/services/connections-api.service";
import { MetricsApiService } from "@shared/services/metrics-api.service";
import { ConfirmDialogComponent } from "@shared/components/confirm-dialog/confirm-dialog.component";
import { ConnectionFormComponent } from "@views/connections/connection-form/connection-form.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    LoadingOverlayComponent,
    ToastContainerComponent,
    ShortcutsHelpDialogComponent,
    SidebarComponent,
    HeaderComponent,
    MatIconModule,
    ConnectionModalComponent,
    ConfirmDialogComponent,
    ConnectionFormComponent,
  ],
  templateUrl: "./app.html",
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild("connectionModal") connectionModal!: ConnectionModalComponent;

  private boundToggleTheme: (() => void) | null = null;
  private boundCloseTopModal: (() => void) | null = null;
  private boundOpenConnectionModal: (() => void) | null = null;
  private boundVisibilityChange: (() => void) | null = null;
  connectionState = inject(ConnectionStateService);
  shortcutsService = inject(KeyboardShortcutsService);
  dialogService = inject(DialogService);
  themeService = inject(ThemeService);
  router = inject(Router);
  private connectionsApi = inject(ConnectionsApiService);
  private metricsApi = inject(MetricsApiService);

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

  ngOnInit(): void {
    this.themeService.initFromSettings();

    this.boundToggleTheme = () => this.themeService.toggle();
    this.boundCloseTopModal = () => this.shortcutsService.shortcutsHelpVisible.set(false);
    this.boundOpenConnectionModal = () => this.connectionModal?.open();
    this.boundVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        this.connectionsApi.invalidateConnections();
        this.metricsApi.invalidateMetrics();
        this.connectionsApi.listConnectionsWithRefresh();
        this.metricsApi.fetchMetricsWithRefresh();
      }
    };

    document.addEventListener("zenith:toggle-theme", this.boundToggleTheme);
    document.addEventListener("zenith:close-top-modal", this.boundCloseTopModal);
    document.addEventListener("zenith:open-connection-modal", this.boundOpenConnectionModal);
    document.addEventListener("visibilitychange", this.boundVisibilityChange);
  }

  ngOnDestroy(): void {
    if (this.boundToggleTheme) {
      document.removeEventListener("zenith:toggle-theme", this.boundToggleTheme);
    }
    if (this.boundCloseTopModal) {
      document.removeEventListener("zenith:close-top-modal", this.boundCloseTopModal);
    }
    if (this.boundOpenConnectionModal) {
      document.removeEventListener("zenith:open-connection-modal", this.boundOpenConnectionModal);
    }
    if (this.boundVisibilityChange) {
      document.removeEventListener("visibilitychange", this.boundVisibilityChange);
    }
  }
}
