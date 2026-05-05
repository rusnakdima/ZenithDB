import { Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-kbd-badge",
  standalone: true,
  imports: [CommonModule],
  template: `<kbd
    class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
    >{{ shortcut() }}</kbd
  >`,
})
export class KbdBadgeComponent {
  shortcut = input.required<string>();
}
