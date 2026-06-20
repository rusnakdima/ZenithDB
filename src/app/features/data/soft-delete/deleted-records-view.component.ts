import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { SoftDeleteService, DeletedRecord } from "./soft-delete.service";
import { ConfirmService } from "@shared/services/confirm.service";
import { ToastService } from "@services/services.toast.service";
import { RowData } from "@entities/entities.connection.config";
@Component({
  selector: "app-deleted-records-view",
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./deleted-records-view.component.html",
})
export class DeletedRecordsViewComponent {
  private softDeleteService = inject(SoftDeleteService);
  private confirmService = inject(ConfirmService);
  private toast = inject(ToastService);
  @Input() collectionName = "";
  @Input() columns: { name: string; dataType: string }[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() restoreComplete = new EventEmitter<void>();
  deletedRecords = signal<DeletedRecord[]>([]);
  loading = signal(false);
  selectedRecords = signal<Set<number>>(new Set());
  expandedRows = signal<Set<number>>(new Set());
  allSelected = computed(
    () =>
      this.deletedRecords().length > 0 &&
      this.selectedRecords().size === this.deletedRecords().length
  );
  selectedCount = computed(() => this.selectedRecords().size);
  async loadDeletedRecords(): Promise<void> {
    if (!this.collectionName) return;
    this.loading.set(true);
    try {
      const records = await this.softDeleteService.getDeletedRecords(this.collectionName);
      this.deletedRecords.set(records);
    } catch (e) {
      this.toast.error(`Failed to load deleted records: ${(e as Error).message}`);
    } finally {
      this.loading.set(false);
    }
  }
  onToggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedRecords.set(new Set());
    } else {
      this.selectedRecords.set(new Set(this.deletedRecords().map((_, i) => i)));
    }
  }
  onToggleRow(index: number): void {
    const selected = new Set(this.selectedRecords());
    if (selected.has(index)) {
      selected.delete(index);
    } else {
      selected.add(index);
    }
    this.selectedRecords.set(selected);
  }
  onToggleExpand(index: number): void {
    const expanded = new Set(this.expandedRows());
    if (expanded.has(index)) {
      expanded.delete(index);
    } else {
      expanded.add(index);
    }
    this.expandedRows.set(expanded);
  }
  isExpanded(index: number): boolean {
    return this.expandedRows().has(index);
  }
  isSelected(index: number): boolean {
    return this.selectedRecords().has(index);
  }
  async restoreRecord(index: number): Promise<void> {
    const record = this.deletedRecords()[index];
    if (!record) return;
    try {
      await this.softDeleteService.restore(this.collectionName, record);
      this.deletedRecords.update((records) => records.filter((_, i) => i !== index));
      this.selectedRecords.update((selected) => {
        const newSelected = new Set(selected);
        newSelected.delete(index);
        return newSelected;
      });
      this.restoreComplete.emit();
    } catch (e) {
      this.toast.error(`Failed to restore record: ${(e as Error).message}`);
    }
  }
  async restoreSelected(): Promise<void> {
    if (this.selectedCount() === 0) return;
    const selectedIndexes = Array.from(this.selectedRecords());
    const records = selectedIndexes.map((i) => this.deletedRecords()[i]);
    try {
      const result = await this.softDeleteService.bulkRestore(this.collectionName, records);
      if (result.failed > 0) {
        this.toast.warning(`Restored ${result.restored} records, ${result.failed} failed`);
      } else {
        this.toast.success(`Restored ${result.restored} records`);
      }
      await this.loadDeletedRecords();
      this.selectedRecords.set(new Set());
      this.restoreComplete.emit();
    } catch (e) {
      this.toast.error(`Failed to restore records: ${(e as Error).message}`);
    }
  }
  async permanentDeleteRecord(index: number): Promise<void> {
    const record = this.deletedRecords()[index];
    if (!record) return;
    const confirmed = await this.confirmService.confirm({
      title: "Permanent Delete",
      message: `Are you sure you want to permanently delete this record? This action cannot be undone.`,
      confirmText: "Delete",
      confirmClass:
        "rounded-xl border border-[var(--accent)]/50 bg-transparent px-4 py-3 text-sm font-medium text-[var(--accent)] transition-colors hover:border-[var(--accent)]",
    });
    if (!confirmed) return;
    try {
      await this.softDeleteService.permanentDelete(this.collectionName, record);
      this.deletedRecords.update((records) => records.filter((_, i) => i !== index));
      this.selectedRecords.update((selected) => {
        const newSelected = new Set(selected);
        newSelected.delete(index);
        return newSelected;
      });
      this.toast.success("Record permanently deleted");
    } catch (e) {
      this.toast.error(`Failed to delete record: ${(e as Error).message}`);
    }
  }
  async permanentDeleteSelected(): Promise<void> {
    if (this.selectedCount() === 0) return;
    const confirmed = await this.confirmService.confirm({
      title: "Permanent Delete",
      message: `Are you sure you want to permanently delete ${this.selectedCount()} records? This action cannot be undone.`,
      confirmText: "Delete All",
      confirmClass:
        "rounded-xl border border-[var(--accent)]/50 bg-transparent px-4 py-3 text-sm font-medium text-[var(--accent)] transition-colors hover:border-[var(--accent)]",
    });
    if (!confirmed) return;
    const selectedIndexes = Array.from(this.selectedRecords());
    const records = selectedIndexes.map((i) => this.deletedRecords()[i]);
    try {
      const result = await this.softDeleteService.bulkPermanentDelete(this.collectionName, records);
      if (result.failed > 0) {
        this.toast.warning(`Deleted ${result.deleted} records, ${result.failed} failed`);
      } else {
        this.toast.success(`Deleted ${result.deleted} records`);
      }
      await this.loadDeletedRecords();
      this.selectedRecords.set(new Set());
    } catch (e) {
      this.toast.error(`Failed to delete records: ${(e as Error).message}`);
    }
  }
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString();
  }
  getCellValue(row: RowData, columnName: string): string {
    const value = row[columnName];
    if (value == null) return "null";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }
  formatOriginalValues(record: DeletedRecord): string {
    if (!record._originalValues) return "N/A";
    return JSON.stringify(record._originalValues, null, 2);
  }
  onClose(): void {
    this.close.emit();
  }
}
