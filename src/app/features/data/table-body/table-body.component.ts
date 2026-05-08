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
import { RowData, ColumnInfo } from "@shared/models/connection.config";
import { CheckboxComponent } from "@shared/components/checkbox/checkbox.component";
import { CellEditorComponent } from "@app/features/data/cell-editor/cell-editor.component";

@Component({
  selector: "app-table-body",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatIconModule, CheckboxComponent, CellEditorComponent],
  templateUrl: "./table-body.component.html",
})
export class TableBodyComponent {
  @Input() data: RowData[] = [];
  @Input() columns: ColumnInfo[] = [];
  @Input() visibleColumnsList: string[] = [];
  @Input() columnWidths: Record<string, number> = {};
  @Input() selectedRows: Set<number> = new Set();
  @Input() editingCell: { row: number; col: string } | null = null;
  @Input() editValue = "";

  @Output() rowClick = new EventEmitter<{ row: RowData; event: MouseEvent }>();
  @Output() toggleRow = new EventEmitter<number>();
  @Output() toggleSelectAll = new EventEmitter<void>();
  @Output() startEdit = new EventEmitter<{ rowIndex: number; col: string; value: unknown }>();
  @Output() saveEdit = new EventEmitter<void>();
  @Output() cancelEdit = new EventEmitter<void>();
  @Output() duplicateRow = new EventEmitter<RowData>();
  @Output() deleteRow = new EventEmitter<RowData>();
  @Output() viewJson = new EventEmitter<RowData>();

  allSelected = computed(() => this.data.length > 0 && this.selectedRows.size === this.data.length);

  trackByRow(index: number, row: RowData): string {
    return String(row["_id"] || row["id"] || index);
  }

  formatValue(value: unknown): string {
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  isSelected(index: number): boolean {
    return this.selectedRows.has(index);
  }

  isCellModified(rowIndex: number, col: string): boolean {
    return this.editingCell?.row === rowIndex && this.editingCell?.col === col;
  }

  onRowClick(row: RowData, event: MouseEvent, rowIndex: number) {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "checkbox") {
      event.stopPropagation();
      return;
    }
    this.rowClick.emit({ row, event });
  }

  onToggleRow(index: number) {
    this.toggleRow.emit(index);
  }

  onToggleSelectAll() {
    this.toggleSelectAll.emit();
  }

  onStartEdit(rowIndex: number, col: string, value: unknown) {
    this.startEdit.emit({ rowIndex, col, value });
  }

  onSaveEdit() {
    this.saveEdit.emit();
  }

  onCancelEdit() {
    this.cancelEdit.emit();
  }

  onDuplicateRow(row: RowData) {
    this.duplicateRow.emit(row);
  }

  onDeleteRow(row: RowData) {
    this.deleteRow.emit(row);
  }

  onViewJson(row: RowData) {
    this.viewJson.emit(row);
  }
}
