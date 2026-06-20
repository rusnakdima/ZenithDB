import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";

@Component({
  selector: "app-stats-card",
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: "./stats-card.component.html",
})
export class StatsCardComponent {
  @Input() label = "";
  @Input() value: string | number = 0;
  @Input() icon = "";
  @Input() iconBgClass = "bg-blue-500";
  @Input() iconColorClass = "text-white";
}
