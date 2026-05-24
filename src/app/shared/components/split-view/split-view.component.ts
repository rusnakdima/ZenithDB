import { Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-split-view",
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (mode() === "none") {
      <div class="h-full w-full">
        <ng-content></ng-content>
      </div>
    }
    @if (mode() === "horizontal") {
      <div class="flex h-full w-full flex-row">
        <div class="h-full w-1/2">
          <ng-content></ng-content>
        </div>
        <div class="h-full w-1/2 border-l border-[var(--border-subtle)]">
          <ng-content></ng-content>
        </div>
      </div>
    }
    @if (mode() === "vertical") {
      <div class="flex h-full w-full flex-col">
        <div class="h-1/2 w-full">
          <ng-content></ng-content>
        </div>
        <div class="h-1/2 w-full border-t border-[var(--border-subtle)]">
          <ng-content></ng-content>
        </div>
      </div>
    }
  `,
})
export class SplitViewComponent {
  mode = input<"none" | "horizontal" | "vertical">("none");
}
