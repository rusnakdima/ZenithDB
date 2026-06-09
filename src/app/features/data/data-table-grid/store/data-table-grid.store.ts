import { Injectable, signal, computed } from "@angular/core";
import { RowData, ColumnInfo } from "@shared/models/connection.config";

@Injectable()
export class DataTableGridStore {
  readonly data = signal<RowData[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string>("");

  readonly sortColumn = signal("");
  readonly sortDirection = signal<"asc" | "desc">("asc");

  readonly selectedRows = signal<Set<number>>(new Set());
  readonly visibleColumns = signal<Set<string>>(new Set());
  readonly columnOrder = signal<string[]>([]);
  readonly columnWidths = signal<Record<string, number>>({});

  readonly allSelected = computed(
    () => this.data().length > 0 && this.selectedRows().size === this.data().length
  );

  readonly visibleColumnsList = computed(() => {
    const visible = this.visibleColumns();
    const order = this.columnOrder();
    if (order.length > 0) {
      return order.filter((c) => visible.has(c));
    }
    if (visible.size === 0) return [];
    return Array.from(visible);
  });

  readonly itemCount = computed(() => this.data().length);

  setData(rows: RowData[], totalCount: number): void {
    this.data.set(rows);
    this.total.set(totalCount);
  }

  setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }

  setError(message: string): void {
    this.error.set(message);
  }

  clearError(): void {
    this.error.set("");
  }

  setSort(column: string, direction: "asc" | "desc"): void {
    this.sortColumn.set(column);
    this.sortDirection.set(direction);
  }

  toggleSort(column: string): void {
    const newDirection: "asc" | "desc" =
      this.sortColumn() === column && this.sortDirection() === "asc" ? "desc" : "asc";
    this.setSort(column, newDirection);
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedRows.set(new Set());
    } else {
      this.selectedRows.set(new Set(this.data().map((_, i) => i)));
    }
  }

  toggleRow(index: number): void {
    this.selectedRows.update((selected) => {
      const next = new Set(selected);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  clearSelection(): void {
    this.selectedRows.set(new Set());
  }

  isSelected(index: number): boolean {
    return this.selectedRows().has(index);
  }

  getSelectedData(): RowData[] {
    const selected = Array.from(this.selectedRows());
    return selected.map((i) => this.data()[i]);
  }

  initColumns(columns: ColumnInfo[]): void {
    const widths: Record<string, number> = {};
    const visible = new Set<string>();

    columns.forEach((c) => {
      widths[c.name] = 150;
      visible.add(c.name);
    });

    this.columnWidths.set(widths);
    this.visibleColumns.set(visible);
    this.columnOrder.set(columns.map((c) => c.name));
  }

  setColumnOrder(order: string[]): void {
    this.columnOrder.set(order);
  }

  setColumnWidth(colName: string, width: number): void {
    this.columnWidths.update((w) => ({ ...w, [colName]: width }));
  }

  toggleColumnVisibility(colName: string): void {
    this.visibleColumns.update((v) => {
      const next = new Set(v);
      if (next.has(colName)) {
        next.delete(colName);
      } else {
        next.add(colName);
      }
      return next;
    });
  }

  showAllColumns(columns: ColumnInfo[]): void {
    this.visibleColumns.set(new Set(columns.map((c) => c.name)));
  }

  hideAllColumns(): void {
    this.visibleColumns.set(new Set());
  }

  reset(): void {
    this.data.set([]);
    this.total.set(0);
    this.loading.set(false);
    this.error.set("");
    this.sortColumn.set("");
    this.sortDirection.set("asc");
    this.selectedRows.set(new Set());
    this.visibleColumns.set(new Set());
    this.columnOrder.set([]);
    this.columnWidths.set({});
  }
}
