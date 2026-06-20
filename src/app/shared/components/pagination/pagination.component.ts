import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
@Component({
  selector: "app-pagination",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  templateUrl: "./pagination.component.html",
})
export class PaginationComponent {
  private cdr = inject(ChangeDetectorRef);
  @Input() totalItems = 0;
  @Input() currentPage = 0;
  @Input() pageSize = 50;
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();
  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize) || 1;
  }
  get hasNextPage(): boolean {
    return this.currentPage < this.totalPages - 1;
  }
  get hasPrevPage(): boolean {
    return this.currentPage > 0;
  }
  get startIndex(): number {
    return this.currentPage * this.pageSize + 1;
  }
  get endIndex(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalItems);
  }
  nextPage() {
    if (this.hasNextPage) {
      this.pageChange.emit(this.currentPage + 1);
    }
  }
  prevPage() {
    if (this.hasPrevPage) {
      this.pageChange.emit(this.currentPage - 1);
    }
  }
  firstPage() {
    this.pageChange.emit(0);
  }
  lastPage() {
    this.pageChange.emit(this.totalPages - 1);
  }
  onPageSizeChange(size: number) {
    this.pageSizeChange.emit(size);
    this.pageChange.emit(0);
  }
}
