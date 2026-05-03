import { Component, Input, Output, EventEmitter, signal, computed } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ColumnInfo } from "../../models/collection.types";

export interface DataTableColumn {
  name: string;
  dataType: string;
  sortable?: boolean;
}

@Component({
  selector: "app-data-table",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./data-table.component.html",
})
export class DataTableComponent {
  @Input() set columnsInput(value: DataTableColumn[]) {
    this._columns.set(value || []);
  }
  @Input() set dataInput(value: any[]) {
    this._data.set(value || []);
  }
  @Input() selectable = true;
  @Input() loading = false;

  @Output() rowSelected = new EventEmitter<any[]>();
  @Output() rowClicked = new EventEmitter<any>();
  @Output() sortChanged = new EventEmitter<{ column: string; direction: "asc" | "desc" }>();
  @Output() rowAction = new EventEmitter<{ action: string; row: any }>();

  _columns = signal<DataTableColumn[]>([]);
  _data = signal<any[]>([]);
  selectedRows = signal<Set<number>>(new Set());
  sortColumn = signal<string>("");
  sortDirection = signal<"asc" | "desc">("asc");
  editingCell: { row: number; col: string } | null = null;
  editValue = "";

  columns = computed(() => this._columns());
  data = computed(() => this._data());

  allSelected = computed(() => {
    const rows = this._data();
    return rows.length > 0 && this.selectedRows().size === rows.length;
  });

  toggleSelectAll() {
    if (this.allSelected()) {
      this.selectedRows.set(new Set());
    } else {
      this.selectedRows.set(new Set(this._data().map((_, i) => i)));
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
    return Array.from(this.selectedRows()).map((i) => this._data()[i]);
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

  formatValue(value: any, dataType: string): string {
    if (value === null || value === undefined) return "null";
    if (dataType === "object" || dataType === "array") {
      return JSON.stringify(value);
    }
    return String(value);
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

  onEdit(rowIndex: number, col: string, value: any) {
    this.editingCell = { row: rowIndex, col };
    this.editValue = String(value ?? "");
  }

  saveEdit(rowIndex: number) {
    if (!this.editingCell) return;
    const row = this._data()[rowIndex];
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
  }

  trackByIndex(index: number): number {
    return index;
  }
}
