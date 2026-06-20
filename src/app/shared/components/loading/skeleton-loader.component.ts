import {
  Component,
  Input,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from "@angular/core";
type SkeletonVariant = "text" | "card" | "table-row" | "avatar" | "button";
@Component({
  selector: "app-skeleton-loader",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./skeleton-loader.component.html",
})
export class SkeletonLoaderComponent {
  private cdr = inject(ChangeDetectorRef);
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
