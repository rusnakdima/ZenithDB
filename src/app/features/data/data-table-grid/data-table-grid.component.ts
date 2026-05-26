import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  ChangeDetectionStrategy,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import {
  CdkDragDrop,
  CdkDrag,
  CdkDropList,
  CdkDragPreview,
  CdkDragPlaceholder,
  moveItemInArray,
} from "@angular/cdk/drag-drop";
import { ColumnInfo, RowData } from "@shared/models/connection.config";
import { FormatValuePipe } from "@shared/pipes/format-value.pipe";
import { trackByRow } from "@shared/utils/collection.utils";

@Component({
  selector: "app-data-table-grid",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "table-container",
    style:
      "display: flex; flex-direction: column; height: 100%; width: max-content; max-width: max-content; box-sizing: border-box; overflow-x: auto;",
  },
  imports: [
    FormsModule,
    MatIconModule,
    CdkDrag,
    CdkDropList,
    CdkDragPreview,
    CdkDragPlaceholder,
    FormatValuePipe,
  ],
  templateUrl: "./data-table-grid.component.html",
})
export class DataTableGridComponent {
  @Input() data: RowData[] = [];
  @Input() columns: ColumnInfo[] = [];
  @Input() columnWidths: Record<string, number> = {};
  @Input() columnOrder: string[] = [];
  @Input() sortColumn = "";
  @Input() sortDirection: "asc" | "desc" = "asc";
  @Input() selectedRows: Set<number> = new Set();
  @Input() previewData: RowData[] = [];
  @Input() renderMode: "full" | "header-only" | "body-only" = "full";
  @Input() showScrollbar = false;

  @Output() sortChange = new EventEmitter<{ column: string; direction: "asc" | "desc" }>();
  @Output() columnDrop = new EventEmitter<CdkDragDrop<ColumnInfo[]>>();
  @Output() columnResizeStart = new EventEmitter<{ col: string; event: MouseEvent }>();
  @Output() toggleSelectAll = new EventEmitter<void>();
  @Output() toggleRow = new EventEmitter<number>();
  @Output() rowClick = new EventEmitter<{ row: RowData; event: MouseEvent }>();
  @Output() viewJson = new EventEmitter<RowData>();

  showColumnMenu = signal(false);
  hoveredRowIndex = signal<number | null>(null);
  draggedColumnName = signal<string>("");
  previewWidth = signal<number>(150);
  visibleColumns = signal<Set<string>>(new Set());

  visibleColumnsList = computed(() => {
    const visible = new Set(this.columns.map((c) => c.name));
    if (this.columnOrder.length > 0) {
      return this.columnOrder.filter((c) => visible.has(c));
    }
    return Array.from(visible);
  });

  gridTemplateColumns = computed(() => {
    const widths = this.columnWidths;
    const cols = this.visibleColumnsList().map((col) => `${widths[col] || 150}px`);
    return `40px ${cols.join(" ")} 40px`;
  });

  headerColsStyle = computed(() => "40px");

  colWidthStyle = computed(() => "150px");

  allSelected = computed(() => this.data.length > 0 && this.selectedRows.size === this.data.length);

  previewRows = computed(() => this.previewData.slice(0, 5));

  isSelected(index: number): boolean {
    return this.selectedRows.has(index);
  }

  onSort(event: { column: string; direction: "asc" | "desc" }) {
    this.sortChange.emit(event);
  }

  onSortByColumn(column: string) {
    const newDirection: "asc" | "desc" =
      this.sortColumn === column && this.sortDirection === "asc" ? "desc" : "asc";
    this.sortChange.emit({ column, direction: newDirection });
  }

  getSortIcon(column: string): "asc" | "desc" | "none" {
    if (this.sortColumn !== column) return "none";
    return this.sortDirection;
  }

  onColumnDrop(event: CdkDragDrop<ColumnInfo[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const currentOrder = [...this.columnOrder];
    moveItemInArray(currentOrder, event.previousIndex, event.currentIndex);
    this.columnDrop.emit(event);
  }

  onColumnResizeStart(col: string, event: MouseEvent) {
    this.columnResizeStart.emit({ col, event });
  }

  onToggleSelectAll() {
    this.toggleSelectAll.emit();
  }

  onToggleRow(index: number) {
    this.toggleRow.emit(index);
  }

  onRowHover(rowIndex: number) {
    this.hoveredRowIndex.set(rowIndex);
  }

  onRowLeave() {
    this.hoveredRowIndex.set(null);
  }

  onRowClick(row: RowData, event: MouseEvent, rowIndex: number) {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "checkbox") {
      event.stopPropagation();
      return;
    }
    this.rowClick.emit({ row, event });
  }

  onViewJson(row: RowData) {
    this.viewJson.emit(row);
  }

  onToggleColumnMenu() {
    this.showColumnMenu.update((v) => !v);
  }

  showAllCols() {
    const all = new Set(this.columns.map((c) => c.name));
    this.visibleColumns.set(all);
  }

  hideAllCols() {
    this.visibleColumns.set(new Set());
  }

  toggleColVisibility(colName: string) {
    this.visibleColumns.update((v) => {
      const newSet = new Set(v);
      if (newSet.has(colName)) {
        newSet.delete(colName);
      } else {
        newSet.add(colName);
      }
      return newSet;
    });
  }

  onDragStarted(columnName: string, width: number) {
    this.draggedColumnName.set(columnName);
    this.previewWidth.set(width || 150);
  }

  onDragReleased() {
    this.draggedColumnName.set("");
  }

  getCellValue(row: RowData, columnName: string): string {
    const value = row[columnName];
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  formatValue(value: unknown): string {
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  trackRow = trackByRow;

  getTypeIcon(dataType: string): string {
    const t = dataType.toLowerCase();
    if (t === "string" || t === "text") return "Aa";
    if (t === "number" || t === "integer" || t === "decimal" || t === "float") return "#";
    if (t === "boolean") return "T/F";
    if (t === "date" || t === "datetime" || t === "timestamp") return "dt";
    if (t === "object" || t === "json") return "{}";
    if (t === "array") return "[]";
    return "?";
  }

  getTypeColor(dataType: string): string {
    const t = dataType.toLowerCase();
    if (t === "string" || t === "text") return "text-blue-400";
    if (t === "number" || t === "integer" || t === "decimal" || t === "float")
      return "text-emerald-400";
    if (t === "boolean") return "text-orange-400";
    if (t === "date" || t === "datetime" || t === "timestamp") return "text-purple-400";
    if (t === "object" || t === "json") return "text-yellow-400";
    if (t === "array") return "text-pink-400";
    return "text-slate-400";
  }
}
