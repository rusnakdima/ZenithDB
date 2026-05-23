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
  ChangeDetectionStrategy,
  input,
} from "@angular/core";
import { CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { DataStoreService } from "@services/core/data-store.service";
import { ClipboardService } from "@shared/services/clipboard.service";
import { ToastService } from "@services/toast.service";
import { ExportService } from "@shared/services/export.service";
import { PersistentStorageService } from "@shared/services/persistent-storage.service";
import { DiagnosticLoggerService } from "@shared/services/diagnostic-logger.service";
import { ColumnInfo, RowData, FilterExpression } from "@shared/models/connection.config";
import { formatJsonLines, highlightJsonLine, safeJsonParse } from "@shared/utils/json.utils";
import { PaginationComponent } from "@shared/components/pagination/pagination.component";
import { withErrorHandling } from "@shared/utils/error-handler.utils";
import { TableBodyComponent } from "@app/features/data/table-body/table-body.component";
import { ColumnManagerComponent } from "@app/features/data/column-manager/column-manager.component";
import {
  ExportDialogComponent,
  ExportFormat,
} from "@app/features/data/export-dialog/export-dialog.component";

@Component({
  selector: "app-data-grid",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatIconModule,
    PaginationComponent,
    TableBodyComponent,
    ColumnManagerComponent,
    ExportDialogComponent,
  ],
  templateUrl: "./data-grid.component.html",
})
export class DataGridComponent implements OnInit, OnChanges, OnDestroy {
  private isResizingInProgress = false;
  private resizeMoveHandler: ((e: MouseEvent) => void) | null = null;
  private resizeUpHandler: (() => void) | null = null;
  private resizeRAFId: number | null = null;
  private resizeLastWidth = 0;
  private persistentStorage = inject(PersistentStorageService);
  private diagLogger = inject(DiagnosticLoggerService);
  @Input() collectionName = "";
  @Input() filter = "";
  @Input() page = 0;
  @Input() pageSize = 50;
  @Input() showInspector = false;
  @Input() viewMode: "grid" | "json" = "grid";
  @Input() inputVisibleColumns: string[] = [];
  @Input() reloadTrigger = 0;
  @Input() columns: ColumnInfo[] = [];
  @Output() documentClick = new EventEmitter<RowData>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() viewModeChange = new EventEmitter<"grid" | "json">();
  @Output() columnsOrderChange = new EventEmitter<string[]>();

  private lastCollectionName = "";
  private lastFilter = "";
  private lastPageNum = -1;
  private lastPageSizeNum = -1;
  private lastReloadTrigger = 0;
  private hasInitialized = false;
  private hasLoadedColumnOrder = false;

  ngOnChanges(changes: SimpleChanges) {
    if (!this.collectionName) {
      return;
    }

    const collectionChanged =
      this.hasInitialized && changes["collectionName"]?.currentValue !== this.lastCollectionName;
    const filterChanged = changes["filter"]?.currentValue !== this.lastFilter;
    const pageChanged = changes["page"]?.currentValue !== this.lastPageNum;
    const pageSizeChanged = changes["pageSize"]?.currentValue !== this.lastPageSizeNum;
    const visibleColumnsChanged = changes["inputVisibleColumns"]?.currentValue !== undefined;
    const reloadTriggerChanged = changes["reloadTrigger"]?.currentValue !== this.lastReloadTrigger;
    const columnsChanged = changes["columns"]?.currentValue !== undefined;

    if (collectionChanged) {
      this.lastCollectionName = this.collectionName;
      this.lastFilter = this.filter;
      this.lastPageNum = this.page;
      this.lastPageSizeNum = this.pageSize;
      this.hasInitialized = true;
      this.loadData();
    } else if (filterChanged || pageChanged || pageSizeChanged) {
      this.lastFilter = this.filter;
      this.lastPageNum = this.page;
      this.lastPageSizeNum = this.pageSize;
      this.loadData();
    } else if (columnsChanged && this.columns.length > 0 && this.collectionName) {
      this.initColumnWidths();
      this.loadData();
      return;
    }

    if (reloadTriggerChanged) {
      this.lastReloadTrigger = this.reloadTrigger;
      this.loadData(true);
    }
  }

  data = signal<RowData[]>([]);
  total = signal(0);
  loading = signal(false);
  error = "";

  sortColumn = signal("");
  sortDirection = signal<"asc" | "desc">("asc");

  selectedRows = signal<Set<number>>(new Set());
  visibleColumns = signal<Set<string>>(new Set());
  columnOrder = signal<string[]>([]);
  showColumnMenu = signal(false);
  resizingColumn = signal<string | null>(null);
  columnWidths = signal<Record<string, number>>({});

  private dataStore = inject(DataStoreService);
  private toast = inject(ToastService);
  private clipboard = inject(ClipboardService);
  private exportService = inject(ExportService);

  showExportDialog = signal(false);

  allSelected = computed(
    () => this.data().length > 0 && this.selectedRows().size === this.data().length
  );
  startIndex = computed(() => this.page * this.pageSize + 1);
  endIndex = computed(() => Math.min((this.page + 1) * this.pageSize, this.total()));

  visibleColumnsList = computed(() => {
    const all = this.columns.map((c) => c.name);
    const visible = this.visibleColumns();
    const order = this.columnOrder();
    if (order.length > 0) {
      return order.filter((c) => visible.has(c));
    }
    if (visible.size === 0) return [];
    return all.filter((c) => visible.has(c));
  });

  visibleColumnsFiltered = computed(() => {
    const visible = this.visibleColumnsList();
    return this.columns.filter((c) => visible.includes(c.name));
  });

  async ngOnInit() {
    this.hasInitialized = true;
    if (this.collectionName) {
      if (this.columns.length === 0) {
        await this.loadColumnsFallback();
      } else {
        this.columns = [...this.columns];
        this.initColumnWidths();
      }
      await this.loadData();
    }
  }

  initColumnWidths() {
    const widths: Record<string, number> = {};
    this.columnWidths.set(widths);

    const allColumnNames = this.columns.map((c) => c.name);
    const defaultOrder = allColumnNames;

    if (!this.hasLoadedColumnOrder) {
      const savedOrder = this.loadColumnOrder();
      if (savedOrder.length > 0) {
        const validCols = savedOrder.filter((c) => this.columns.some((col) => col.name === c));
        if (validCols.length > 0) {
          const missing = allColumnNames.filter((c) => !validCols.includes(c));
          this.columnOrder.set([...validCols, ...missing]);
          this.hasLoadedColumnOrder = true;
        } else {
          this.columnOrder.set(defaultOrder);
        }
      } else {
        this.columnOrder.set(defaultOrder);
      }
    }

    this.columns.forEach((c) => {
      widths[c.name] = 150;
    });
    this.columnWidths.set(widths);

    const visible = new Set<string>();
    this.columns.forEach((c) => visible.add(c.name));
    this.visibleColumns.set(visible);
  }

  async loadData(forceRefresh?: boolean) {
    this.loading.set(true);
    this.error = "";
    const t0 = Date.now();
    try {
      let filterObj: FilterExpression | undefined;
      if (this.filter) {
        filterObj = safeJsonParse<FilterExpression | undefined>(this.filter, undefined);
        if (filterObj === undefined) {
          this.error = "Invalid filter JSON";
          this.loading.set(false);
          return;
        }
      }
      const result = await this.dataStore.queryData(
        this.collectionName,
        {
          filter: filterObj,
          skip: this.page * this.pageSize,
          limit: this.pageSize,
          order_by: this.sortColumn() || undefined,
          direction: this.sortDirection(),
        },
        forceRefresh
      );
      this.diagLogger.logDataLoad("datagrid-loadData", result.data.length, Date.now() - t0, {
        total: result.total,
        page: this.page,
        pageSize: this.pageSize,
      });
      this.data.set(result.data as RowData[]);
      this.total.set(result.total);
    } catch (e) {
      this.error = (e as Error).message || "Failed to load data";
      this.toast.error(this.error);
    } finally {
      this.loading.set(false);
    }
  }

  async loadColumnsFallback() {
    try {
      const schema = await this.dataStore.describeCollection(this.collectionName);
      this.columns = schema.columns;
      this.initColumnWidths();
    } catch (e) {}
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
    this.page = Math.ceil(this.total() / this.pageSize) - 1;
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

  onSort(event: { column: string; direction: "asc" | "desc" }) {
    this.sortColumn.set(event.column);
    this.sortDirection.set(event.direction);
    this.loadData();
  }

  startEdit(rowIndex: number, col: string, value: unknown) {}

  async saveEdit() {}

  cancelEdit() {}

  async deleteRow(row: RowData) {}

  onRowClick(row: RowData, event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "checkbox") {
      event.stopPropagation();
      return;
    }
    this.documentClick.emit(row);
  }

  toggleSelectAll() {
    if (this.allSelected()) {
      this.selectedRows.set(new Set());
    } else {
      this.selectedRows.set(new Set(this.data().map((_, i) => i)));
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
    this.isResizingInProgress = true;
    const startX = event.clientX;
    const startWidth = this.columnWidths()[col] || 150;
    this.resizeLastWidth = startWidth;

    this.resizeMoveHandler = (e: MouseEvent) => {
      if (this.resizeRAFId !== null) return;
      this.resizeRAFId = requestAnimationFrame(() => {
        this.resizeRAFId = null;
        const newWidth = Math.max(80, startWidth + (e.clientX - startX));
        if (Math.abs(newWidth - this.resizeLastWidth) >= 5) {
          this.resizeLastWidth = newWidth;
          this.columnWidths.update((w) => ({ ...w, [col]: newWidth }));
        }
      });
    };

    const upHandler = () => {
      if (this.resizeRAFId !== null) {
        cancelAnimationFrame(this.resizeRAFId);
        this.resizeRAFId = null;
      }
      this.resizingColumn.set(null);
      this.isResizingInProgress = false;
      if (this.resizeMoveHandler) {
        document.removeEventListener("mousemove", this.resizeMoveHandler);
      }
      document.removeEventListener("mouseup", upHandler);
      this.resizeMoveHandler = null;
      this.resizeUpHandler = null;
    };
    this.resizeUpHandler = upHandler;

    document.addEventListener("mousemove", this.resizeMoveHandler);
    document.addEventListener("mouseup", this.resizeUpHandler);
  }

  ngOnDestroy() {
    if (this.resizeMoveHandler) {
      document.removeEventListener("mousemove", this.resizeMoveHandler);
      this.resizeMoveHandler = null;
    }
    if (this.resizeUpHandler) {
      document.removeEventListener("mouseup", this.resizeUpHandler);
      this.resizeUpHandler = null;
    }
    if (this.resizeRAFId !== null) {
      cancelAnimationFrame(this.resizeRAFId);
      this.resizeRAFId = null;
    }
    this.isResizingInProgress = false;
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
        this.columnOrder.update((order) => [...order.filter((c) => c !== col), col]);
      }
      return newSet;
    });
  }

  onColumnDrop(event: CdkDragDrop<string[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const currentOrder = [...this.columnOrder()];
    moveItemInArray(currentOrder, event.previousIndex, event.currentIndex);
    this.columnOrder.set(currentOrder);
    this.saveColumnOrder(currentOrder);
    this.hasLoadedColumnOrder = true;
    this.columnsOrderChange.emit(currentOrder);
  }

  private saveColumnOrder(order: string[]) {
    if (!this.collectionName) return;
    this.persistentStorage.setColumnOrder(this.collectionName, order);
  }

  private loadColumnOrder(): string[] {
    if (!this.collectionName) return [];
    const stored = this.persistentStorage.getColumnOrder(this.collectionName);
    if (stored && stored.length > 0) {
      const valid = stored.filter((c) => this.columns.some((col) => col.name === c));
      if (valid.length > 0) return valid;
    }
    return [];
  }

  showAllColumns() {
    const visible = new Set<string>();
    this.columns.forEach((c) => visible.add(c.name));
    this.visibleColumns.set(visible);
  }

  async duplicateRow(row: RowData) {}

  viewJson(row: RowData) {
    this.documentClick.emit(row);
  }

  async copyRowJson(row: RowData) {
    await this.clipboard.copyToClipboard(JSON.stringify(row, null, 2), "Copied to clipboard");
  }

  onPageChange(newPage: number) {
    this.page = newPage;
    this.pageChange.emit(this.page);
    this.loadData();
  }

  changePageSize(size: number) {
    this.pageSize = size;
    this.page = 0;
    this.pageChange.emit(this.page);
    this.loadData();
  }

  isCellModified(rowIndex: number, col: string): boolean {
    return false;
  }

  formatValue(value: unknown): string {
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  trackByRow(index: number, row: RowData): string {
    return String(row["_id"] || row["id"] || index);
  }

  formatJsonLines(obj: unknown): string[] {
    return formatJsonLines(JSON.stringify(obj, null, 2));
  }

  highlightJsonLine(line: string): string {
    return highlightJsonLine(line);
  }

  getSelectedData(): RowData[] {
    const selected = Array.from(this.selectedRows());
    return selected.map((i) => this.data()[i]);
  }

  async exportData(format: ExportFormat) {
    const dataToExport = this.selectedRows().size > 0 ? this.getSelectedData() : this.data();
    const filename = `${this.collectionName}_export_${Date.now()}`;

    try {
      await this.exportService.export({ format, filename }, dataToExport);
    } catch (error) {
      if ((error as Error).message !== "Export cancelled") {
        this.toast.error("Export failed");
      }
    }
    this.showExportDialog.set(false);
  }

  toggleExportDialog() {
    this.showExportDialog.update((v) => !v);
  }

  closeExportDialog() {
    this.showExportDialog.set(false);
  }
}
