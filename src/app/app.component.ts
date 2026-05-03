import { Component, inject, signal, HostBinding } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";
import { CommandPaletteComponent } from "./shared/components/command-palette/command-palette.component";
import { ConnectionStateService } from "./shared/services/connection-state.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterLink, RouterOutlet, CommandPaletteComponent],
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
