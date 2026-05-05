import { Component, Input, Output, EventEmitter, computed, signal } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

@Component({
  selector: "app-pagination",
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div
      class="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-6 py-3"
    >
      <div class="flex items-center gap-6">
        <span class="text-sm text-[var(--text-dim)]">
          Showing <span class="font-bold text-[var(--accent)]">{{ startIndex }}</span
          >-<span class="font-bold text-[var(--accent)]">{{ endIndex }}</span> of
          <span class="font-bold text-[var(--accent)]">{{ totalItems }}</span>
        </span>
        <div class="flex items-center gap-3">
          <span class="text-xs text-[var(--text-muted)]">Rows per page:</span>
          <select
            class="cursor-pointer rounded-lg border border-[var(--border-visible)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-main)] focus:border-[var(--accent)] focus:outline-none"
            [value]="pageSize"
            (change)="onPageSizeChange(+$any($event.target).value)"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="rounded-lg p-2 text-[var(--text-dim)] transition-all hover:bg-[var(--bg-card)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30"
          [disabled]="!hasPrevPage"
          (click)="firstPage()"
          title="First page"
        >
          <mat-icon fontIcon="first_page" class="!text-base"></mat-icon>
        </button>
        <button
          class="rounded-lg p-2 text-[var(--text-dim)] transition-all hover:bg-[var(--bg-card)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30"
          [disabled]="!hasPrevPage"
          (click)="prevPage()"
          title="Previous page"
        >
          <mat-icon fontIcon="chevron_left" class="!text-base"></mat-icon>
        </button>
        <span class="px-3 text-sm text-[var(--text-dim)]"
          >Page {{ currentPage + 1 }} of {{ totalPages || 1 }}</span
        >
        <button
          class="rounded-lg p-2 text-[var(--text-dim)] transition-all hover:bg-[var(--bg-card)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30"
          [disabled]="!hasNextPage"
          (click)="nextPage()"
          title="Next page"
        >
          <mat-icon fontIcon="chevron_right" class="!text-base"></mat-icon>
        </button>
        <button
          class="rounded-lg p-2 text-[var(--text-dim)] transition-all hover:bg-[var(--bg-card)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30"
          [disabled]="!hasNextPage"
          (click)="lastPage()"
          title="Last page"
        >
          <mat-icon fontIcon="last_page" class="!text-base"></mat-icon>
        </button>
      </div>
    </div>
  `,
})
export class PaginationComponent {
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
