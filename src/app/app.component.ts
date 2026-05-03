import { Component, inject, signal, HostBinding } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";
import { CommandPaletteComponent } from "./shared/components/command-palette/command-palette.component";
import { LoadingOverlayComponent } from "./shared/components/loading/loading-overlay.component";
import { ToastContainerComponent } from "./components/toast/toast-container.component";
import { ConnectionStateService } from "./shared/services/connection-state.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterLink, RouterOutlet, CommandPaletteComponent, LoadingOverlayComponent, ToastContainerComponent],
  templateUrl: "./app.component.html",
})
export class AppComponent {
  connectionState = inject(ConnectionStateService);
  isDarkMode = signal(true);

  @HostBinding("class.dark")
  get darkMode(): boolean {
    return this.isDarkMode();
  }

  toggleTheme() {
    this.isDarkMode.update((v) => !v);
  }
}
