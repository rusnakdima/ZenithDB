import { Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-kbd-badge",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./kbd-badge.component.html",
})
export class KbdBadgeComponent {
  shortcut = input.required<string>();
}
