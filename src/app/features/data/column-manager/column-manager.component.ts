import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
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
import { isNullOrUndefined } from "@shared/utils/collection.utils";
import { SortableHeaderComponent } from "@shared/components/sortable-header/sortable-header.component";
import { DataTypeBadgeComponent } from "@shared/components/data-type-badge/data-type-badge.component";
import { CheckboxComponent } from "@shared/components/checkbox/checkbox.component";
import { logger } from "../../../services/logger.service";

@Component({
  selector: "app-column-manager",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatIconModule,
    CdkDrag,
    CdkDragPreview,
    CdkDragPlaceholder,
    SortableHeaderComponent,
    DataTypeBadgeComponent,
    CheckboxComponent,
  ],
  templateUrl: "./column-manager.component.html",
})
export class ColumnManagerComponent {
  private cdr = inject(ChangeDetectorRef);

  @Input() columns: ColumnInfo[] = [];
  @Input() visibleColumnsList: string[] = [];
  @Input() columnOrder: string[] = [];
  @Input() columnWidths: Record<string, number> = {};
  @Input() sortColumn = "";
  @Input() sortDirection: "asc" | "desc" = "asc";
  @Input() allSelected = false;
  @Input() previewData: RowData[] = [];

  @Output() sortChange = new EventEmitter<{ column: string; direction: "asc" | "desc" }>();
  @Output() columnDrop = new EventEmitter<CdkDragDrop<string[]>>();
  @Output() columnResizeStart = new EventEmitter<{ col: string; event: MouseEvent }>();
  @Output() toggleSelectAll = new EventEmitter<void>();
  @Output() showAllColumns = new EventEmitter<void>();
  @Output() toggleColumnVisibility = new EventEmitter<string>();
  @Output() columnsOrderChange = new EventEmitter<string[]>();
  @Output() toggleColumnMenu = new EventEmitter<void>();

  showColumnMenu = signal(false);
  draggedColumnName = signal<string>("");
  previewWidth = signal<number>(150);
  dragColumnName = signal<string | null>(null);

  previewRows = computed(() => this.previewData.slice(0, 5));

  gridTemplateColumns = computed(() => {
    const widths = this.columnWidths;
    const cols = this.visibleColumnsList.map((col) => `${widths[col] || 150}px`);
    return `40px ${cols.join(" ")} 56px`;
  });

  onSort(event: { column: string; direction: "asc" | "desc" }) {
    this.sortChange.emit(event);
  }

  onColumnDrop(event: CdkDragDrop<string[]>) {
    this.columnDrop.emit(event);
  }

  onColumnResizeStart(col: string, event: MouseEvent) {
    this.columnResizeStart.emit({ col, event });
  }

  onToggleSelectAll() {
    this.toggleSelectAll.emit();
  }

  onShowAllColumns() {
    this.showAllColumns.emit();
  }

  onToggleColumnVisibility(col: string) {
    logger.debug("[DATA]", `Column visibility toggled: ${col}`);
    this.toggleColumnVisibility.emit(col);
  }

  onToggleColumnMenu() {
    this.toggleColumnMenu.emit();
  }

  onDragStarted(columnName: string, width: number) {
    this.draggedColumnName.set(columnName);
    this.previewWidth.set(width || 150);
    this.dragColumnName.set(columnName);
  }

  onDragReleased() {
    this.draggedColumnName.set("");
    this.dragColumnName.set(null);
  }

  getCellValue(row: RowData, columnName: string): string {
    const value = row[columnName];
    if (isNullOrUndefined(value)) return "null";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  get visibleColumnsSet(): Set<string> {
    return new Set(this.visibleColumnsList);
  }
}
