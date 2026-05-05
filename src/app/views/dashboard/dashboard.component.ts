import { Component } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [MatIconModule, CommonModule],
  templateUrl: "./dashboard.component.html",
})
export class DashboardComponent {}
