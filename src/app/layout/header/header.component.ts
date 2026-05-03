import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { ConnectionStateService } from "../../shared/services/connection-state.service";

@Component({
  selector: "app-header",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./header.component.html",
})
export class HeaderComponent {
  connectionState = inject(ConnectionStateService);
  isDarkMode = true;

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
  }
}
