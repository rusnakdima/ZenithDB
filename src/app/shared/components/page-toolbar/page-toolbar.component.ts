import { Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-page-toolbar",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-4 py-3"
    >
      <div class="flex items-center gap-4">
        <ng-content select="[toolbar-left]"></ng-content>
      </div>
      <div class="flex items-center gap-3">
        <ng-content select="[toolbar-right]"></ng-content>
      </div>
    </div>
  `,
})
export class PageToolbarComponent {}
