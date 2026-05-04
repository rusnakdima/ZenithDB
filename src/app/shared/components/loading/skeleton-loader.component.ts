import { Component, Input } from "@angular/core";

type SkeletonVariant = "text" | "card" | "table-row" | "avatar" | "button";

@Component({
  selector: "app-skeleton-loader",
  standalone: true,
  templateUrl: "./skeleton-loader.component.html",
})
export class SkeletonLoaderComponent {
  @Input() variant: SkeletonVariant = "text";
  @Input() count: number = 1;
  @Input() columns: number = 4;

  get items(): number[] {
    return Array(this.count).fill(0);
  }

  get columnsArray(): number[] {
    return Array(this.columns).fill(0);
  }
}
