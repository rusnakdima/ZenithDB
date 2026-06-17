import { Component, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { CommonModule } from "@angular/common";
import { logger } from "../../services/logger.service";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [MatIconModule, CommonModule],
  templateUrl: "./dashboard.view.html",
})
export class DashboardComponent {
  

  constructor() {
    logger.debug("[DASHBOARD]", "Dashboard view initialized");
  }
}
