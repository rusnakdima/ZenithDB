import { Component, Input, Output, EventEmitter, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { CdkDragDrop, CdkDrag, CdkDropList, moveItemInArray } from "@angular/cdk/drag-drop";
import { ColumnInfo } from "@shared/models/connection.config";
import { SortableHeaderComponent } from "@shared/components/sortable-header/sortable-header.component";
import { DataTypeBadgeComponent } from "@shared/components/data-type-badge/data-type-badge.component";
import { CheckboxComponent } from "@shared/components/checkbox/checkbox.component";

@Component({
  selector: "app-column-manager",
  standalone: true,
  imports: [
    FormsModule,
    MatIconModule,
    CdkDrag,
    CdkDropList,
    SortableHeaderComponent,
    DataTypeBadgeComponent,
    CheckboxComponent,
  ],
  templateUrl: "./column-manager.component.html",
})
export class ColumnManagerComponent {
  @Input() columns: ColumnInfo[] = [];
  @Input() visibleColumnsList: string[] = [];
  @Input() columnOrder: string[] = [];
  @Input() columnWidths: Record<string, number> = {};
  @Input() sortColumn = "";
  @Input() sortDirection: "asc" | "desc" = "asc";
  @Input() allSelected = false;

  @Output() sortChange = new EventEmitter<{ column: string; direction: "asc" | "desc" }>();
  @Output() columnDrop = new EventEmitter<CdkDragDrop<string[]>>();
  @Output() columnResizeStart = new EventEmitter<{ col: string; event: MouseEvent }>();
  @Output() toggleSelectAll = new EventEmitter<void>();
  @Output() showAllColumns = new EventEmitter<void>();
  @Output() toggleColumnVisibility = new EventEmitter<string>();
  @Output() columnsOrderChange = new EventEmitter<string[]>();
  @Output() toggleColumnMenu = new EventEmitter<void>();

  showColumnMenu = signal(false);

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
    this.toggleColumnVisibility.emit(col);
  }

  onToggleColumnMenu() {
    this.showColumnMenu.update((v) => !v);
    this.toggleColumnMenu.emit();
  }

  get visibleColumnsSet(): Set<string> {
    return new Set(this.visibleColumnsList);
  }
}
