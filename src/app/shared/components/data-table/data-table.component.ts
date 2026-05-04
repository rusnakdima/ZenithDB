import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ColumnInfo } from "@shared/models/collection.types";
import { CheckboxComponent } from "@shared/components/checkbox/checkbox.component";

export interface DataTableColumn {
  name: string;
  dataType: string;
  sortable?: boolean;
  visible?: boolean;
  width?: number;
  format?: "text" | "date" | "datetime" | "currency" | "percent" | "boolean" | "status";
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

@Component({
  selector: "app-data-table",
  standalone: true,
  imports: [FormsModule, CheckboxComponent],
  templateUrl: "./data-table.component.html",
})
export class DataTableComponent implements OnInit, OnDestroy {
  @Input() set columnsInput(value: DataTableColumn[]) {
    this._columns.set(value || []);
    this.initColumnVisibility();
  }
  @Input() set dataInput(value: any[]) {
    this._data.set(value || []);
    this.updatePaginatedData();
  }
  @Input() selectable = true;
  @Input() loading = false;
  @Input() pagination: PaginationState | null = null;

  @Output() rowSelected = new EventEmitter<any[]>();
  @Output() rowClicked = new EventEmitter<any>();
  @Output() sortChanged = new EventEmitter<{ column: string; direction: "asc" | "desc" }>();
  @Output() rowAction = new EventEmitter<{ action: string; row: any }>();
  @Output() paginationChange = new EventEmitter<PaginationState>();

  _columns = signal<DataTableColumn[]>([]);
  _data = signal<any[]>([]);
  _filteredData = signal<any[]>([]);
  selectedRows = signal<Set<number>>(new Set());
  sortColumn = signal<string>("");
  sortDirection = signal<"asc" | "desc">("asc");
  editingCell: { row: number; col: string } | null = null;
  editValue = "";
  showColumnMenu = signal(false);
  showRowActions = signal<number | null>(null);
  columnWidths = signal<Record<string, number>>({});
  isResizing = signal(false);
  resizingColumn = signal<string | null>(null);
  startX = 0;
  startWidth = 0;

  pageSizes = [10, 25, 50, 100];
  currentPage = signal(1);
  pageSize = signal(25);
  paginatedData = signal<any[]>([]);

  columns = computed(() => this._columns());
  data = computed(() => this._data());

  allSelected = computed(() => {
    const rows = this.paginatedData();
    return rows.length > 0 && this.selectedRows().size === rows.length;
  });

  visibleColumns = computed(() => this._columns().filter((c) => c.visible !== false));

  pageInfo = computed(() => {
    const total = this.pagination?.total || this._data().length;
    const size = this.pageSize();
    const page = this.currentPage();
    const start = (page - 1) * size + 1;
    const end = Math.min(page * size, total);
    return { start, end, total };
  });

  totalPages = computed(() => {
    const total = this.pagination?.total || this._data().length;
    return Math.ceil(total / this.pageSize());
  });

  ngOnInit() {
    this.initColumnVisibility();
  }

  ngOnDestroy() {
    document.removeEventListener("mousemove", this.onMouseMove.bind(this));
    document.removeEventListener("mouseup", this.onMouseUp.bind(this));
  }

  private initColumnVisibility() {
    const cols = this._columns();
    const visibility: Record<string, boolean> = {};
    for (const col of cols) {
      visibility[col.name] = col.visible !== false;
    }
    this._columns.update((c) => c.map((col) => ({ ...col, visible: col.visible !== false })));
  }

  private updatePaginatedData() {
    const data = this._data();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    const end = start + size;
    this.paginatedData.set(data.slice(start, end));
  }

  toggleSelectAll() {
    if (this.allSelected()) {
      this.selectedRows.set(new Set());
    } else {
      this.selectedRows.set(new Set(this.paginatedData().map((_, i) => i)));
    }
    this.rowSelected.emit(this.getSelectedRows());
  }

  toggleRow(index: number) {
    const selected = new Set(this.selectedRows());
    if (selected.has(index)) {
      selected.delete(index);
    } else {
      selected.add(index);
    }
    this.selectedRows.set(selected);
    this.rowSelected.emit(this.getSelectedRows());
  }

  isSelected(index: number): boolean {
    return this.selectedRows().has(index);
  }

  getSelectedRows(): any[] {
    return Array.from(this.selectedRows()).map((i) => this.paginatedData()[i]);
  }

  onRowClick(row: any, event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.tagName !== "INPUT" || (target as HTMLInputElement).type !== "checkbox") {
      this.rowClicked.emit(row);
    }
  }

  onSort(col: string) {
    if (this.sortColumn() === col) {
      this.sortDirection.update((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      this.sortColumn.set(col);
      this.sortDirection.set("asc");
    }
    this.sortChanged.emit({ column: col, direction: this.sortDirection() });
  }

  isSortable(col: DataTableColumn): boolean {
    return col.sortable !== false;
  }

  getSortIcon(col: string): string {
    if (this.sortColumn() !== col) return "none";
    return this.sortDirection();
  }

  toggleColumnMenu() {
    this.showColumnMenu.update((v) => !v);
  }

  toggleColumnVisibility(colName: string) {
    this._columns.update((cols) =>
      cols.map((c) => (c.name === colName ? { ...c, visible: !c.visible } : c))
    );
  }

  formatValue(value: any, dataType: string, format?: string): string {
    if (value === null || value === undefined) return "null";

    if (format === "date") {
      return this.formatDate(value);
    }
    if (format === "datetime") {
      return this.formatDateTime(value);
    }
    if (format === "currency") {
      return this.formatCurrency(value);
    }
    if (format === "percent") {
      return this.formatPercent(value);
    }
    if (dataType === "object" || dataType === "array") {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private formatDate(value: any): string {
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  }

  private formatDateTime(value: any): string {
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  private formatCurrency(value: any): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(value));
  }

  private formatPercent(value: any): string {
    return `${Number(value).toFixed(2)}%`;
  }

  getTypeBadgeClass(dataType: string): string {
    switch (dataType) {
      case "string":
        return "type-string";
      case "number":
      case "decimal":
      case "integer":
        return "type-number";
      case "boolean":
        return "type-boolean";
      case "object":
        return "type-object";
      case "array":
        return "type-array";
      default:
        return "type-string";
    }
  }

  getStatusBadgeClass(value: string): string {
    const v = value?.toUpperCase();
    if (v === "PAID" || v === "ACTIVE" || v === "COMPLETED") return "status-paid";
    if (v === "PENDING" || v === "PROCESSING") return "status-pending";
    if (v === "FAILED" || v === "ERROR" || v === "CANCELLED") return "status-failed";
    if (v === "REFUNDED") return "status-refunded";
    return "";
  }

  getCellClass(value: any, dataType: string): string {
    if (value === null || value === undefined) return "text-slate-600 dark:text-slate-500 italic";
    if (typeof value === "number" || dataType === "decimal" || dataType === "integer")
      return "text-emerald-600 dark:text-emerald-400";
    if (typeof value === "boolean") return "text-orange-600 dark:text-orange-400";
    if (dataType === "object" || dataType === "array") return "text-slate-500 dark:text-slate-500";
    return "text-slate-700 dark:text-slate-300";
  }

  getBooleanIcon(value: any): boolean {
    return Boolean(value);
  }

  onEdit(rowIndex: number, col: string, value: any) {
    this.editingCell = { row: rowIndex, col };
    this.editValue = String(value ?? "");
  }

  saveEdit(rowIndex: number) {
    if (!this.editingCell) return;
    const row = this.paginatedData()[rowIndex];
    const updated = { ...row, [this.editingCell.col]: this.editValue };
    this.rowAction.emit({ action: "save", row: updated });
    this.editingCell = null;
    this.editValue = "";
  }

  cancelEdit() {
    this.editingCell = null;
    this.editValue = "";
  }

  onDelete(row: any) {
    this.rowAction.emit({ action: "delete", row });
    this.showRowActions.set(null);
  }

  toggleRowActions(index: number) {
    this.showRowActions.update((v) => (v === index ? null : index));
  }

  closeRowActions() {
    this.showRowActions.set(null);
  }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.updatePaginatedData();
    this.emitPagination();
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.updatePaginatedData();
    this.emitPagination();
  }

  firstPage() {
    this.goToPage(1);
  }

  prevPage() {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage() {
    this.goToPage(this.currentPage() + 1);
  }

  lastPage() {
    this.goToPage(this.totalPages());
  }

  private emitPagination() {
    this.paginationChange.emit({
      page: this.currentPage(),
      pageSize: this.pageSize(),
      total: this.pagination?.total || this._data().length,
    });
  }

  startResize(event: MouseEvent, colName: string) {
    this.isResizing.set(true);
    this.resizingColumn.set(colName);
    this.startX = event.clientX;
    const currentWidth = this.columnWidths()[colName] || 150;
    this.startWidth = currentWidth;
    document.addEventListener("mousemove", this.onMouseMove.bind(this));
    document.addEventListener("mouseup", this.onMouseUp.bind(this));
    event.preventDefault();
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.isResizing()) return;
    const colName = this.resizingColumn();
    if (!colName) return;
    const diff = event.clientX - this.startX;
    const newWidth = Math.max(80, this.startWidth + diff);
    this.columnWidths.update((w) => ({ ...w, [colName]: newWidth }));
  }

  private onMouseUp() {
    this.isResizing.set(false);
    this.resizingColumn.set(null);
    document.removeEventListener("mousemove", this.onMouseMove.bind(this));
    document.removeEventListener("mouseup", this.onMouseUp.bind(this));
  }

  getColumnWidth(colName: string): number {
    const col = this._columns().find((c) => c.name === colName);
    if (col?.width) return col.width;
    return this.columnWidths()[colName] || 150;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
