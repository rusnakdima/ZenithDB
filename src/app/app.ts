import {
  Component,
  inject,
  HostBinding,
  OnInit,
  OnDestroy,
  ViewChild,
  signal,
} from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { Router, NavigationEnd } from "@angular/router";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { LoadingOverlayComponent } from "@shared/components/loading/loading-overlay.component";
import { ToastContainerComponent } from "@components/toast/toast-container.component";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { KeyboardShortcutsService } from "@shared/services/keyboard-shortcuts.service";
import { ShortcutsHelpDialogComponent } from "@shared/components/shortcuts-help-dialog/shortcuts-help-dialog.component";
import { DialogService } from "@shared/services/dialog.service";
import { ThemeService } from "@shared/services/theme.service";
import { ConnectionModalComponent } from "@features/connections/connection-modal/connection-modal.component";
import { ConfirmDialogComponent } from "@shared/components/confirm-dialog/confirm-dialog.component";
import { ConnectionFormComponent } from "@views/connections/connection-form/connection-form.component";
import { FloatingBottomNavComponent } from "@components/floating-bottom-nav/floating-bottom-nav.component";
import { HeaderComponent } from "@components/header/header.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    LoadingOverlayComponent,
    ToastContainerComponent,
    ShortcutsHelpDialogComponent,
    ConnectionModalComponent,
    ConfirmDialogComponent,
    ConnectionFormComponent,
    FloatingBottomNavComponent,
    HeaderComponent,
  ],
  templateUrl: "./app.html",
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild("connectionModal") connectionModal!: ConnectionModalComponent;

  private boundToggleTheme: (() => void) | null = null;
  private boundCloseTopModal: (() => void) | null = null;
  private boundOpenConnectionModal: (() => void) | null = null;
  private boundVisibilityChange: (() => void) | null = null;
  private visibilityDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private routeSub: Subscription | null = null;

  isExplorerRoute = signal(false);
  private router = inject(Router);

  connectionState = inject(ConnectionStateService);
  shortcutsService = inject(KeyboardShortcutsService);
  dialogService = inject(DialogService);
  themeService = inject(ThemeService);

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
        if (this.visibilityDebounceTimer) {
          clearTimeout(this.visibilityDebounceTimer);
        }
        this.visibilityDebounceTimer = setTimeout(() => {}, 1000);
      }
    };

    document.addEventListener("zenith:toggle-theme", this.boundToggleTheme);
    document.addEventListener("zenith:close-top-modal", this.boundCloseTopModal);
    document.addEventListener("zenith:open-connection-modal", this.boundOpenConnectionModal);
    document.addEventListener("visibilitychange", this.boundVisibilityChange);
    this.routeSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.isExplorerRoute.set(this.router.url.includes("/explorer"));
      });
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
    if (this.visibilityDebounceTimer) {
      clearTimeout(this.visibilityDebounceTimer);
    }
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }
}
