import { Component, inject, signal, HostBinding, OnInit } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";
import { CommonModule } from "@angular/common";
import { CommandPaletteComponent } from "@shared/components/command-palette/command-palette.component";
import { LoadingOverlayComponent } from "@shared/components/loading/loading-overlay.component";
import { ToastContainerComponent } from "@components/toast/toast-container.component";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { KeyboardShortcutsService } from "@shared/services/keyboard-shortcuts.service";
import { ShortcutsHelpDialogComponent } from "@shared/components/shortcuts-help-dialog/shortcuts-help-dialog.component";
import { DialogService } from "@shared/services/dialog.service";
import { HeaderComponent } from "@layout/header/header.component";
import { SidebarComponent } from "@layout/sidebar/sidebar.component";
import { ThemeService } from "@shared/services/theme.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    RouterLink,
    RouterOutlet,
    CommonModule,
    CommandPaletteComponent,
    LoadingOverlayComponent,
    ToastContainerComponent,
    ShortcutsHelpDialogComponent,
    HeaderComponent,
    SidebarComponent,
  ],
  templateUrl: "./app.component.html",
})
export class AppComponent implements OnInit {
  connectionState = inject(ConnectionStateService);
  shortcutsService = inject(KeyboardShortcutsService);
  dialogService = inject(DialogService);
  themeService = inject(ThemeService);
  isDarkMode = signal(true);

  @HostBinding("class.dark")
  get darkMode(): boolean {
    return this.isDarkMode();
  }

  ngOnInit(): void {
    document.addEventListener("zenith:toggle-theme", () => {
      this.toggleTheme();
    });

    document.addEventListener("zenith:toggle-command-palette", () => {
      document.querySelector("app-command-palette")?.setAttribute("data-toggle", "");
    });

    document.addEventListener("zenith:close-top-modal", () => {
      this.shortcutsService.shortcutsHelpVisible.set(false);
    });
  }

  toggleTheme(): void {
    this.isDarkMode.update((v) => !v);
    this.themeService.toggle();
  }
}