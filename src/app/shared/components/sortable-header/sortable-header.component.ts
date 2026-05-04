import { Component, input, output } from "@angular/core";

@Component({
  selector: "app-sortable-header",
  standalone: true,
  template: `
    <div
      class="flex cursor-pointer items-center gap-1 transition-colors hover:text-white"
      (click)="onSort()"
    >
      <span>{{ column() }}</span>
      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        @if (direction() === "asc") {
          <path d="M12 19V5M5 12l7-7 7 7" />
        } @else if (direction() === "desc") {
          <path d="M12 5v14M5 12l7 7 7-7" />
        } @else {
          <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
        }
      </svg>
    </div>
  `,
})
export class SortableHeaderComponent {
  column = input.required<string>();
  currentSort = input<string>("");
  direction = input<"asc" | "desc" | "none">("none");

  sortChange = output<{ column: string; direction: "asc" | "desc" }>();

  onSort() {
    const newDirection = this.direction() === "asc" ? "desc" : "asc";
    this.sortChange.emit({ column: this.column(), direction: newDirection });
  }
}
