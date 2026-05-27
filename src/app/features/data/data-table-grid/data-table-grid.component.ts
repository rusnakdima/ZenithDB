import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
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
import { ColumnInfo, RowData, FilterExpression } from "@shared/models/connection.config";
import { FormatValuePipe } from "@shared/pipes/format-value.pipe";
import { trackByRow } from "@shared/utils/collection.utils";
import { safeJsonParse } from "@shared/utils/json.utils";
import { DataStoreService } from "@services/core/data-store.service";
import { ClipboardService } from "@shared/services/clipboard.service";
import { ToastService } from "@services/toast.service";
import { ExportService } from "@shared/services/export.service";
import { PersistentStorageService } from "@shared/services/persistent-storage.service";
import { DiagnosticLoggerService } from "@shared/services/diagnostic-logger.service";
import {
  ExportDialogComponent,
  ExportFormat,
} from "@app/features/data/export-dialog/export-dialog.component";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { RecordFormComponent } from "@features/data/record-form/record-form.component";
import { BulkActionBarComponent } from "@features/data/bulk-action-bar/bulk-action-bar.component";

@Component({
  selector: "app-data-table-grid",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatIconModule,
    CdkDrag,
    CdkDropList,
    CdkDragPreview,
    CdkDragPlaceholder,
    FormatValuePipe,
    ExportDialogComponent,
    ModalComponent,
    RecordFormComponent,
    BulkActionBarComponent,
  ],
  templateUrl: "./data-table-grid.component.html",
})
export class DataTableGridComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  private isResizingInProgress = false;
  private resizeMoveHandler: ((e: MouseEvent) => void) | null = null;
  private resizeUpHandler: (() => void) | null = null;
  private resizeRAFId: number | null = null;
  private resizeLastWidth = 0;
  private persistentStorage = inject(PersistentStorageService);
  private diagLogger = inject(DiagnosticLoggerService);
  private dataStore = inject(DataStoreService);
  private toast = inject(ToastService);
  private clipboard = inject(ClipboardService);
  private exportService = inject(ExportService);

  @ViewChild("headerScroll") headerScrollRef!: ElementRef<HTMLDivElement>;
  @ViewChild("bodyScroll") bodyScrollRef!: ElementRef<HTMLDivElement>;

  @Input() collectionName = "";
  @Input() filter = "";
  @Input() page = 0;
  @Input() pageSize = 50;
  @Input() inputVisibleColumns: string[] = [];
  @Input() reloadTrigger = 0;
  @Input() columns: ColumnInfo[] = [];

  @Output() documentClick = new EventEmitter<RowData>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() columnsOrderChange = new EventEmitter<string[]>();
  @Output() dataChange = new EventEmitter<void>();

  private lastCollectionName = "";
  private lastFilter = "";
  private lastPageNum = -1;
  private lastPageSizeNum = -1;
  private lastReloadTrigger = 0;
  private hasInitialized = false;
  private hasLoadedColumnOrder = false;

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

  showExportDialog = signal(false);
  showRecordForm = signal(false);
  recordFormMode = signal<"add" | "edit">("add");
  editingRecord = signal<RowData | null>(null);
  showBulkDeleteConfirm = signal(false);

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
    const order = this.columnOrder();
    const visible = this.visibleColumns();
    if (order.length > 0) {
      return order
        .filter((c) => visible.has(c))
        .map((name) => this.columns.find((c) => c.name === name))
        .filter(Boolean) as ColumnInfo[];
    }
    return this.columns.filter((c) => visible.has(c.name));
  });

  gridTemplateColumns = computed(() => {
    const widths = this.columnWidths();
    const cols = this.visibleColumnsList().map((col) => `${widths[col] || 150}px`);
    return `40px ${cols.join(" ")} 40px`;
  });

  gridTemplateRows = computed(() => {
    const rowCount = this.data().length;
    return `44px repeat(${rowCount}, 44px)`;
  });

  previewRows = computed(() => this.data().slice(0, 5));

  hoveredRowIndex = signal<number | null>(null);
  draggedColumnName = signal<string>("");
  previewWidth = signal<number>(150);

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
      this.loadData(true);
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

  ngAfterViewInit() {
    this.setupScrollSync();
  }

  private setupScrollSync() {
    const headerEl = this.headerScrollRef?.nativeElement;
    const bodyEl = this.bodyScrollRef?.nativeElement;

    if (!headerEl || !bodyEl) return;

    const syncScroll = (source: HTMLElement, target: HTMLElement) => {
      target.scrollLeft = source.scrollLeft;
    };

    bodyEl.addEventListener("scroll", () => syncScroll(bodyEl, headerEl));
    headerEl.addEventListener("scroll", () => syncScroll(headerEl, bodyEl));
  }

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

  initColumnWidths() {
    const widths: Record<string, number> = {};

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

  onSort(event: { column: string; direction: "asc" | "desc" }) {
    this.sortColumn.set(event.column);
    this.sortDirection.set(event.direction);
    this.loadData();
  }

  onSortByColumn(column: string) {
    const newDirection: "asc" | "desc" =
      this.sortColumn() === column && this.sortDirection() === "asc" ? "desc" : "asc";
    this.sortChange.emit({ column, direction: newDirection });
  }

  getSortIcon(column: string): "asc" | "desc" | "none" {
    if (this.sortColumn() !== column) return "none";
    return this.sortDirection();
  }

  onColumnDrop(event: CdkDragDrop<ColumnInfo[]>) {
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

  onToggleSelectAll() {
    if (this.allSelected()) {
      this.selectedRows.set(new Set());
    } else {
      this.selectedRows.set(new Set(this.data().map((_, i) => i)));
    }
  }

  onToggleRow(index: number) {
    const selected = new Set(this.selectedRows());
    if (selected.has(index)) {
      selected.delete(index);
    } else {
      selected.add(index);
    }
    this.selectedRows.set(selected);
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
    this.documentClick.emit(row);
  }

  onViewJson(row: RowData) {
    this.documentClick.emit(row);
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

  trackRow = trackByRow;

  isSelected(index: number): boolean {
    return this.selectedRows().has(index);
  }

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

  onPageChange(newPage: number) {
    this.page = newPage;
    this.pageChange.emit(this.page);
  }

  changePageSize(size: number) {
    this.pageSize = size;
    this.page = 0;
    this.pageChange.emit(this.page);
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

  openAddRecordModal() {
    this.recordFormMode.set("add");
    this.editingRecord.set(null);
    this.showRecordForm.set(true);
  }

  openEditRecordModal(row: RowData) {
    this.recordFormMode.set("edit");
    this.editingRecord.set(row);
    this.showRecordForm.set(true);
  }

  closeRecordForm() {
    this.showRecordForm.set(false);
    this.editingRecord.set(null);
  }

  async handleRecordSave(record: RowData) {
    if ((record as any).__delete) {
      delete (record as any).__delete;
      await this.deleteRecord(record);
    } else {
      try {
        await this.dataStore.saveRow(this.collectionName, record);
        this.toast.success(this.recordFormMode() === "add" ? "Record created" : "Record updated");
        this.closeRecordForm();
        this.dataChange.emit();
        this.loadData(true);
      } catch (e) {
        this.toast.error("Failed to save record: " + (e as Error).message);
      }
    }
  }

  private async deleteRecord(record: RowData) {
    const id = record["_id"] || record["id"];
    if (!id) {
      this.toast.error("Cannot delete: record has no ID");
      return;
    }
    try {
      await this.dataStore.deleteRow(this.collectionName, String(id));
      this.toast.success("Record deleted");
      this.closeRecordForm();
      this.dataChange.emit();
      this.loadData(true);
    } catch (e) {
      this.toast.error("Failed to delete record: " + (e as Error).message);
    }
  }

  onBulkExport() {
    this.showExportDialog.set(true);
  }

  onBulkDelete() {
    this.showBulkDeleteConfirm.set(true);
  }

  async confirmBulkDelete() {
    const selectedData = this.getSelectedData();
    let deleted = 0;
    let failed = 0;

    for (const record of selectedData) {
      const id = record["_id"] || record["id"];
      if (id) {
        try {
          await this.dataStore.deleteRow(this.collectionName, String(id));
          deleted++;
        } catch {
          failed++;
        }
      }
    }

    if (failed > 0) {
      this.toast.warning(`Deleted ${deleted} records, ${failed} failed`);
    } else {
      this.toast.success(`Deleted ${deleted} records`);
    }

    this.selectedRows.set(new Set());
    this.showBulkDeleteConfirm.set(false);
    this.dataChange.emit();
    this.loadData(true);
  }

  cancelBulkDelete() {
    this.showBulkDeleteConfirm.set(false);
  }

  clearSelection() {
    this.selectedRows.set(new Set());
  }

  getIdField(): string | null {
    const pkCol = this.columns.find((c) => c.is_primary_key);
    return pkCol ? pkCol.name : null;
  }

  sortChange = new EventEmitter<{ column: string; direction: "asc" | "desc" }>();
  columnDrop = new EventEmitter<CdkDragDrop<ColumnInfo[]>>();
}
