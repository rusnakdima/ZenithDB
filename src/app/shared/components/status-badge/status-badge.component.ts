import { Component, input } from "@angular/core";
@Component({
  selector: "app-status-badge",
  standalone: true,
  templateUrl: "./status-badge.component.html",
})
export class StatusBadgeComponent {
  status = input.required<"connected" | "offline">();
  size = input<"sm" | "md">();
}
