import { Component, OnInit, OnDestroy, inject, Input, Output, EventEmitter } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatabaseService } from "../../../shared/services/database.service";
import { ColumnInfo } from "../../../shared/models/collection.types";

@Component({
  selector: "app-data-grid",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./data-grid.component.html",
})
export class DataGridComponent implements OnInit, OnDestroy {
  @Input() collectionName = "";
  @Input() filter = "";
  @Input() page = 0;
  @Input() pageSize = 50;
  @Input() showInspector = false;
  @Output() documentClick = new EventEmitter<any>();
  @Output() pageChange = new EventEmitter<number>();

  data: any[] = [];
  columns: ColumnInfo[] = [];
  total = 0;
  loading = false;
  error = "";
  editingCell: { row: number; col: string } | null = null;
  editValue = "";
  sortColumn = "";
  sortDirection: "asc" | "desc" = "asc";

  private db = inject(DatabaseService);

  get totalPages() {
    return Math.ceil(this.total / this.pageSize);
  }
  get hasNextPage() {
    return this.page < this.totalPages - 1;
  }
  get hasPrevPage() {
    return this.page > 0;
  }

  async ngOnInit() {
    if (this.collectionName) {
      await this.loadData();
      await this.loadColumns();
    }
  }

  ngOnDestroy() {}

  async loadData() {
    this.loading = true;
    this.error = "";
    try {
      const result = await this.db.queryData(this.collectionName, {
        filter: this.filter ? { body: this.filter } : undefined,
        order_by: this.sortColumn,
        direction: this.sortDirection,
        skip: this.page * this.pageSize,
        limit: this.pageSize,
      });
      this.data = result.data;
      this.total = result.total;
    } catch (e: any) {
      this.error = e.message || "Failed to load data";
    } finally {
      this.loading = false;
    }
  }

  async loadColumns() {
    try {
      const schema = await this.db.describeCollection(this.collectionName);
      this.columns = schema.columns;
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
    if (this.sortColumn === col) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortColumn = col;
      this.sortDirection = "asc";
    }
    this.loadData();
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
    } catch (e: any) {
      this.error = e.message;
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
    if (confirm(`Delete this row?`)) {
      await this.db.deleteRow(this.collectionName, id);
      await this.loadData();
    }
  }

  onRowClick(row: any) {
    this.documentClick.emit(row);
  }

  async saveNewRow() {
    const newRow: any = {};
    this.columns.forEach((c: ColumnInfo) => (newRow[c.name] = ""));
    try {
      await this.db.saveRow(this.collectionName, newRow);
      await this.loadData();
    } catch (e: any) {
      this.error = e.message;
    }
  }
}
