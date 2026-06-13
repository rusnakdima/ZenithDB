import { Component, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { CommonModule } from "@angular/common";
import { LoggingService } from "@shared/services/logging.service";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [MatIconModule, CommonModule],
  templateUrl: "./dashboard.view.html",
})
export class DashboardComponent {
  private logger = inject(LoggingService);

  constructor() {
    this.logger.debug("[DASHBOARD]", "Dashboard view initialized");
  }
}
