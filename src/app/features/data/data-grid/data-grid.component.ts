import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatabaseService } from "@shared/services/database.service";
import { ToastService } from "@services/toast.service";
import { ExportService } from "@shared/services/export.service";
import { ColumnInfo } from "@shared/models/collection.types";

@Component({
  selector: "app-data-grid",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./data-grid.component.html",
})
export class DataGridComponent implements OnInit, OnDestroy, OnChanges {
  @Input() collectionName = "";
  @Input() filter = "";
  @Input() page = 0;
  @Input() pageSize = 50;
  @Input() showInspector = false;
  @Input() viewMode: "grid" | "json" = "grid";
  @Input() inputVisibleColumns: string[] = [];
  @Output() documentClick = new EventEmitter<any>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() viewModeChange = new EventEmitter<"grid" | "json">();

  private lastCollectionName = "";
  private lastFilter = "";
  private lastPageNum = -1;
  private lastPageSizeNum = -1;

  ngOnChanges(changes: SimpleChanges) {
    if (!this.collectionName) return;

    const collectionChanged = changes["collectionName"]?.currentValue !== this.lastCollectionName;
    const filterChanged = changes["filter"]?.currentValue !== this.lastFilter;
    const pageChanged = changes["page"]?.currentValue !== this.lastPageNum;
    const pageSizeChanged = changes["pageSize"]?.currentValue !== this.lastPageSizeNum;
    const visibleColumnsChanged = changes["inputVisibleColumns"]?.currentValue !== undefined;

    if (collectionChanged) {
      this.lastCollectionName = this.collectionName;
      this.lastFilter = this.filter;
      this.lastPageNum = this.page;
      this.lastPageSizeNum = this.pageSize;
      this.loadColumns();
      this.loadData();
    } else if (filterChanged || pageChanged || pageSizeChanged) {
      this.lastFilter = this.filter;
      this.lastPageNum = this.page;
      this.lastPageSizeNum = this.pageSize;
      this.loadData();
    }

    if (visibleColumnsChanged && this.inputVisibleColumns.length > 0) {
      this.visibleColumns.set(new Set(this.inputVisibleColumns));
    }
  }

  data: any[] = [];
  columns: ColumnInfo[] = [];
  total = 0;
  loading = false;
  error = "";

  editingCell: { row: number; col: string } | null = null;
  editValue = "";
  sortColumn = signal("");
  sortDirection = signal<"asc" | "desc">("asc");

  selectedRows = signal<Set<number>>(new Set());
  visibleColumns = signal<Set<string>>(new Set());
  showColumnMenu = signal(false);
  resizingColumn = signal<string | null>(null);
  columnWidths = signal<Record<string, number>>({});

  private db = inject(DatabaseService);
  private toast = inject(ToastService);
  private exportService = inject(ExportService);

  showExportMenu = signal(false);
  exportFormat = signal<"csv" | "json" | "jsonl" | "sql" | "markdown">("csv");

  get totalPages() {
    return Math.ceil(this.total / this.pageSize);
  }
  get hasNextPage() {
    return this.page < this.totalPages - 1;
  }
  get hasPrevPage() {
    return this.page > 0;
  }
  get allSelected() {
    return this.data.length > 0 && this.selectedRows().size === this.data.length;
  }
  get startIndex() {
    return this.page * this.pageSize + 1;
  }
  get endIndex() {
    return Math.min((this.page + 1) * this.pageSize, this.total);
  }

  visibleColumnsList = computed(() => {
    const all = this.columns.map((c) => c.name);
    const visible = this.visibleColumns();
    if (visible.size === 0) return all;
    return all.filter((c) => visible.has(c));
  });

  async ngOnInit() {
    if (this.collectionName) {
      await this.loadData();
      await this.loadColumns();
      this.initColumnWidths();
    }
  }

  ngOnDestroy() {}

  initColumnWidths() {
    const widths: Record<string, number> = {};
    this.columns.forEach((c) => {
      widths[c.name] = 150;
    });
    this.columnWidths.set(widths);
    const visible = new Set<string>();
    this.columns.forEach((c) => visible.add(c.name));
    this.visibleColumns.set(visible);
  }

  async loadData() {
    this.loading = true;
    this.error = "";
    try {
      let filterObj: any = undefined;
      if (this.filter) {
        try {
          filterObj = JSON.parse(this.filter);
        } catch {
          this.error = "Invalid filter JSON";
          this.loading = false;
          return;
        }
      }
      const result = await this.db.queryData(this.collectionName, {
        filter: filterObj,
        order_by: this.sortColumn() || undefined,
        direction: this.sortDirection(),
        skip: this.page * this.pageSize,
        limit: this.pageSize,
      });
      this.data = result.data;
      this.total = result.total;
    } catch (e: any) {
      this.error = e.message || "Failed to load data";
      this.toast.error(this.error);
    } finally {
      this.loading = false;
    }
  }

  async loadColumns() {
    try {
      const schema = await this.db.describeCollection(this.collectionName);
      this.columns = schema.columns;
      this.initColumnWidths();
    } catch {}
  }

  async nextPage() {
    this.page++;
    this.pageChange.emit(this.page);
    await this.loadData();
  }

  async prevPage() {
    this.page--;
    this.pageChange.emit(this.page);
    await this.loadData();
  }

  async firstPage() {
    this.page = 0;
    this.pageChange.emit(this.page);
    await this.loadData();
  }

  async lastPage() {
    this.page = this.totalPages - 1;
    this.pageChange.emit(this.page);
    await this.loadData();
  }

  async applyFilter() {
    this.page = 0;
    await this.loadData();
  }

  async clearFilter() {
    this.filter = "";
    this.page = 0;
    await this.loadData();
  }

  sortBy(col: string) {
    if (this.sortColumn() === col) {
      this.sortDirection.update((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      this.sortColumn.set(col);
      this.sortDirection.set("asc");
    }
    this.loadData();
  }

  getSortIcon(col: string): string {
    if (this.sortColumn() !== col) return "none";
    return this.sortDirection();
  }

  startEdit(rowIndex: number, col: string, value: any) {
    this.editingCell = { row: rowIndex, col };
    this.editValue = String(value ?? "");
  }

  async saveEdit() {
    if (!this.editingCell) return;
    const { row, col } = this.editingCell;
    const rowData = { ...this.data[row], [col]: this.editValue };
    try {
      await this.db.saveRow(this.collectionName, rowData);
      this.data[row] = rowData;
      this.toast.success("Cell updated");
    } catch (e: any) {
      this.error = e.message;
      this.toast.error("Failed to update cell");
    }
    this.editingCell = null;
    this.editValue = "";
  }

  cancelEdit() {
    this.editingCell = null;
    this.editValue = "";
  }

  async deleteRow(row: any) {
    const id = row._id || row.id;
    if (!id) return;
    this.toast.show({
      type: "warning",
      message: "Are you sure you want to delete this row?",
      action: {
        label: "Delete",
        callback: async () => {
          try {
            await this.db.deleteRow(this.collectionName, id);
            this.toast.success("Row deleted");
            await this.loadData();
          } catch (e: any) {
            this.toast.error("Failed to delete row");
          }
        },
      },
    });
  }

  onRowClick(row: any, event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "checkbox") {
      return;
    }
    this.documentClick.emit(row);
  }

  toggleSelectAll() {
    if (this.allSelected) {
      this.selectedRows.set(new Set());
    } else {
      this.selectedRows.set(new Set(this.data.map((_, i) => i)));
    }
  }

  toggleRow(index: number) {
    const selected = new Set(this.selectedRows());
    if (selected.has(index)) {
      selected.delete(index);
    } else {
      selected.add(index);
    }
    this.selectedRows.set(selected);
  }

  isSelected(index: number): boolean {
    return this.selectedRows().has(index);
  }

  onColumnResizeStart(col: string, event: MouseEvent) {
    event.preventDefault();
    this.resizingColumn.set(col);
    const startX = event.clientX;
    const startWidth = this.columnWidths()[col] || 150;

    const onMove = (e: MouseEvent) => {
      const newWidth = Math.max(80, startWidth + (e.clientX - startX));
      this.columnWidths.update((w) => ({ ...w, [col]: newWidth }));
    };

    const onUp = () => {
      this.resizingColumn.set(null);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  toggleColumnMenu() {
    this.showColumnMenu.update((v) => !v);
  }

  toggleColumnVisibility(col: string) {
    this.visibleColumns.update((visible) => {
      const newSet = new Set(visible);
      if (newSet.has(col)) {
        newSet.delete(col);
      } else {
        newSet.add(col);
      }
      return newSet;
    });
  }

  showAllColumns() {
    const visible = new Set<string>();
    this.columns.forEach((c) => visible.add(c.name));
    this.visibleColumns.set(visible);
  }

  getTypeIcon(dataType: string): string {
    switch (dataType.toLowerCase()) {
      case "string":
      case "text":
        return "Aa";
      case "number":
      case "integer":
      case "decimal":
      case "float":
        return "#";
      case "boolean":
        return "T/F";
      case "date":
      case "datetime":
      case "timestamp":
        return "dt";
      default:
        return "?";
    }
  }

  getTypeIconClass(dataType: string): string {
    switch (dataType.toLowerCase()) {
      case "string":
      case "text":
        return "type-icon string";
      case "number":
      case "integer":
      case "decimal":
      case "float":
        return "type-icon number";
      case "boolean":
        return "type-icon boolean";
      case "date":
      case "datetime":
      case "timestamp":
        return "type-icon date";
      default:
        return "type-icon";
    }
  }

  async duplicateRow(row: any) {
    const { _id, id, ...rest } = row;
    const newRow = { ...rest };
    try {
      await this.db.saveRow(this.collectionName, newRow);
      this.toast.success("Row duplicated");
      await this.loadData();
    } catch (e: any) {
      this.toast.error("Failed to duplicate row");
    }
  }

  viewJson(row: any) {
    this.documentClick.emit(row);
  }

  changePageSize(size: number) {
    this.pageSize = size;
    this.page = 0;
    this.pageChange.emit(this.page);
    this.loadData();
  }

  isCellModified(rowIndex: number, col: string): boolean {
    return this.editingCell?.row === rowIndex && this.editingCell?.col === col;
  }

  formatValue(value: any): string {
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  formatJsonLines(obj: any): string[] {
    const json = JSON.stringify(obj, null, 2);
    return json.split("\n");
  }

  highlightJsonLine(line: string): string {
    let result = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    result = result.replace(/("([^"\\]|\\.)*")\s*:/g, '<span class="text-yellow-400">$1</span>:');
    result = result.replace(/:\s*("([^"\\]|\\.)*")/g, ': <span class="text-green-400">$1</span>');
    result = result.replace(/:\s*(true|false)/g, ': <span class="text-red-400">$1</span>');
    result = result.replace(/:\s*(null)/g, ': <span class="text-slate-500">$1</span>');
    result = result.replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="text-blue-400">$1</span>');

    return result;
  }

  trackByRow(index: number, row: any): string {
    return row._id || row.id || String(index);
  }

  getSelectedData(): any[] {
    const selected = Array.from(this.selectedRows());
    return selected.map((i) => this.data[i]);
  }

  async exportData(format: "csv" | "json" | "jsonl" | "sql" | "markdown") {
    const dataToExport = this.selectedRows().size > 0 ? this.getSelectedData() : this.data;
    const filename = `${this.collectionName}_export_${Date.now()}`;

    try {
      await this.exportService.export({ format, filename }, dataToExport);
    } catch (error: any) {
      if (error.message !== "Export cancelled") {
        this.toast.error("Export failed");
      }
    }
    this.showExportMenu.set(false);
  }

  toggleExportMenu() {
    this.showExportMenu.update((v) => !v);
  }

  closeExportMenu() {
    this.showExportMenu.set(false);
  }
}
