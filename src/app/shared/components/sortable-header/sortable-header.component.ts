import { Component, input, output, ChangeDetectionStrategy } from "@angular/core";
@Component({
  selector: "app-sortable-header",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./sortable-header.component.html",
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
