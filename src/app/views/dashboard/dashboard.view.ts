import { Component, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { CommonModule } from "@angular/common";
import { AppLoggerService } from "@shared/services/app-logger.service";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [MatIconModule, CommonModule],
  templateUrl: "./dashboard.view.html",
})
export class DashboardComponent {
  private logger = inject(AppLoggerService);

  constructor() {
    this.logger.debug("[DASHBOARD]", "Dashboard view initialized");
  }
}
