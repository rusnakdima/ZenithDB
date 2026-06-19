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
import { ColumnInfo, RowData } from "@app/models/connection.config";
import { FormatValuePipe } from "@shared/pipes/format-value.pipe";
import { trackByRow, isNullOrUndefined } from "@shared/utils/collection.utils";
import {
  ExportDialogComponent,
  ExportFormat,
} from "@app/features/data/export-dialog/export-dialog.component";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { RecordFormComponent } from "@features/data/record-form/record-form.component";
import { BulkActionBarComponent } from "@features/data/bulk-action-bar/bulk-action-bar.component";
import { DataTableGridStore } from "./store/data-table-grid.store";
import { DataTableGridService } from "./services/data-table-grid.service";
import { logger } from "@core/services/logger.service";

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
  private store = inject(DataTableGridStore);
  private service = inject(DataTableGridService);

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

  data = this.store.data;
  total = this.store.total;
  loading = this.store.loading;
  error = this.store.error;

  sortColumn = this.store.sortColumn;
  sortDirection = this.store.sortDirection;

  selectedRows = this.store.selectedRows;
  visibleColumns = this.store.visibleColumns;
  columnOrder = this.store.columnOrder;
  showColumnMenu = signal(false);
  resizingColumn = signal<string | null>(null);
  columnWidths = this.store.columnWidths;

  showExportDialog = signal(false);
  showRecordForm = signal(false);
  recordFormMode = signal<"add" | "edit">("add");
  editingRecord = signal<RowData | null>(null);
  showBulkDeleteConfirm = signal(false);

  allSelected = this.store.allSelected;

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
    const cols = this.visibleColumnsList().map((col) => {
      const w = widths[col];
      return w ? `${w}px` : `minmax(100px, 1fr)`;
    });
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
      this.onLoadData();
    } else if (filterChanged || pageChanged || pageSizeChanged) {
      this.lastFilter = this.filter;
      this.lastPageNum = this.page;
      this.lastPageSizeNum = this.pageSize;
      this.onLoadData(true);
    } else if (columnsChanged && this.columns.length > 0 && this.collectionName) {
      this.initColumnWidths();
      this.onLoadData();
      return;
    }

    if (reloadTriggerChanged) {
      this.lastReloadTrigger = this.reloadTrigger;
      this.onLoadData(true);
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
        await this.onLoadColumnsFallback();
      } else {
        this.columns = [...this.columns];
        this.initColumnWidths();
      }
      await this.onLoadData();
    }
  }

  ngOnDestroy() {
    this.store.reset();
  }

  initColumnWidths() {
    const allColumnNames = this.columns.map((c) => c.name);
    const defaultOrder = allColumnNames;

    if (!this.hasLoadedColumnOrder) {
      const savedOrder = this.service.loadColumnOrder(this.collectionName, this.columns);
      if (savedOrder.length > 0) {
        const validCols = savedOrder.filter((c) => this.columns.some((col) => col.name === c));
        if (validCols.length > 0) {
          this.store.setColumnOrder([
            ...validCols,
            ...allColumnNames.filter((c) => !validCols.includes(c)),
          ]);
          this.hasLoadedColumnOrder = true;
        } else {
          this.store.setColumnOrder(defaultOrder);
        }
      } else {
        this.store.setColumnOrder(defaultOrder);
      }
    }

    this.store.initColumns(this.columns);
  }

  private async onLoadData(forceRefresh?: boolean) {
    const filterObj = this.service.parseFilter(this.filter);
    if (filterObj === undefined && this.filter) {
      return;
    }
    try {
      await this.service.loadData(
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
    } catch {
      // error handled in service
    }
  }

  private async onLoadColumnsFallback() {
    try {
      const columns = await this.service.loadColumnsFallback(this.collectionName);
      this.columns = columns;
      this.initColumnWidths();
    } catch {
      // error handled in service
    }
  }

  onSort(event: { column: string; direction: "asc" | "desc" }) {
    this.store.setSort(event.column, event.direction);
    this.onLoadData();
  }

  onSortByColumn(column: string) {
    this.store.toggleSort(column);
    this.sortChange.emit({ column, direction: this.sortDirection() });
  }

  getSortIcon(column: string): "asc" | "desc" | "none" {
    if (this.sortColumn() !== column) return "none";
    return this.sortDirection();
  }

  onColumnDrop(event: CdkDragDrop<string[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const currentOrder = [...this.visibleColumnsList()];
    moveItemInArray(currentOrder, event.previousIndex, event.currentIndex);
    const newOrder = [...this.columnOrder()];
    const movedCol = currentOrder[event.currentIndex];
    const oldIdx = newOrder.indexOf(movedCol);
    newOrder.splice(oldIdx, 1);
    newOrder.splice(
      event.currentIndex > event.previousIndex ? event.currentIndex : event.currentIndex,
      0,
      movedCol
    );
    this.store.setColumnOrder(newOrder);
    this.service.saveColumnOrder(this.collectionName, newOrder);
    this.hasLoadedColumnOrder = true;
    this.columnsOrderChange.emit(newOrder);
  }

  onColumnResizeStart(col: string, event: MouseEvent) {
    event.preventDefault();
    this.resizingColumn.set(col);
    const startX = event.clientX;
    const startWidth = this.columnWidths()[col] || 150;
    let resizeLastWidth = startWidth;

    const moveHandler = (e: MouseEvent) => {
      const newWidth = Math.max(80, startWidth + (e.clientX - startX));
      if (Math.abs(newWidth - resizeLastWidth) >= 5) {
        resizeLastWidth = newWidth;
        this.store.setColumnWidth(col, newWidth);
      }
    };

    const upHandler = () => {
      this.resizingColumn.set(null);
      document.removeEventListener("mousemove", moveHandler);
      document.removeEventListener("mouseup", upHandler);
    };

    document.addEventListener("mousemove", moveHandler);
    document.addEventListener("mouseup", upHandler);
  }

  onToggleSelectAll() {
    this.store.toggleSelectAll();
  }

  onToggleRow(index: number) {
    this.store.toggleRow(index);
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
    this.store.showAllColumns(this.columns);
  }

  hideAllCols() {
    this.store.hideAllColumns();
  }

  toggleColVisibility(colName: string) {
    this.store.toggleColumnVisibility(colName);
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
    if (isNullOrUndefined(value)) return "null";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  trackRow = trackByRow;

  isSelected(index: number): boolean {
    return this.store.isSelected(index);
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
      return "text-[var(--accent)]";
    if (t === "boolean") return "text-[var(--accent)]";
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
    return this.store.getSelectedData();
  }

  async exportData(format: ExportFormat) {
    try {
      logger.info("[DATA_GRID]", `Exporting ${this.collectionName} as ${format.toUpperCase()}`);
      await this.service.exportData(this.collectionName, format);
    } catch {
      // error handled in service
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
      try {
        logger.info("[DATA_GRID]", `Deleting record in ${this.collectionName}`);
        await this.service.deleteRecord(this.collectionName, record);
        this.closeRecordForm();
        this.dataChange.emit();
        this.onLoadData(true);
      } catch {
        // error handled in service
      }
    } else {
      try {
        const isEdit = this.recordFormMode() === "edit";
        logger.info(
          "[DATA_GRID]",
          `${isEdit ? "Updating" : "Creating"} record in ${this.collectionName}`
        );
        await this.service.saveRecord(this.collectionName, record);
        this.closeRecordForm();
        this.dataChange.emit();
        this.onLoadData(true);
      } catch {
        // error handled in service
      }
    }
  }

  onBulkExport() {
    this.showExportDialog.set(true);
  }

  onBulkDelete() {
    this.showBulkDeleteConfirm.set(true);
  }

  async confirmBulkDelete() {
    try {
      const count = this.store.selectedRows().size;
      logger.info("[DATA_GRID]", `Bulk deleting ${count} records from ${this.collectionName}`);
      await this.service.bulkDelete(this.collectionName);
      this.store.clearSelection();
      this.showBulkDeleteConfirm.set(false);
      this.dataChange.emit();
      this.onLoadData(true);
    } catch {
      // error handled in service
    }
  }

  cancelBulkDelete() {
    this.showBulkDeleteConfirm.set(false);
  }

  clearSelection() {
    this.store.clearSelection();
  }

  clearError() {
    this.store.clearError();
  }

  getIdField(): string | null {
    return this.service.getIdField(this.columns);
  }

  sortChange = new EventEmitter<{ column: string; direction: "asc" | "desc" }>();
  columnDrop = new EventEmitter<CdkDragDrop<ColumnInfo[]>>();
}
