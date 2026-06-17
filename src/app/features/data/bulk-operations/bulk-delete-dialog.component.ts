import { Component, Input, Output, EventEmitter, signal, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { BulkOperationsService, BulkDeleteRequest } from "./bulk-operations.service";
import { ToastService } from "@services/toast.service";
import { logger } from "../../../services/logger.service";

@Component({
  selector: "app-bulk-delete-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: "./bulk-delete-dialog.component.html",
})
export class BulkDeleteDialogComponent {
  private readonly bulkOps = inject(BulkOperationsService);
  private readonly toast = inject(ToastService);

  @Input() collectionName = "";
  @Input() documentIds: string[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<void>();

  softDelete = signal(false);
  isProcessing = signal(false);

  recordCount = computed(() => this.documentIds.length);

  onSoftDeleteChange(value: boolean): void {
    this.softDelete.set(value);
  }

  getConfirmMessage(): string {
    return `Delete ${this.recordCount()} selected record${this.recordCount() !== 1 ? "s" : ""}?`;
  }

  onCancel(): void {
    this.closed.emit();
  }

  async onConfirm(): Promise<void> {
    this.isProcessing.set(true);

    try {
      logger.info("[DATA_BULK]", `Confirm bulk delete: ${this.documentIds.length} records`);
      const request: BulkDeleteRequest = {
        collectionName: this.collectionName,
        documentIds: this.documentIds,
        softDelete: this.softDelete(),
      };

      await this.bulkOps.executeBulkDelete(request);
      this.deleted.emit();
      this.closed.emit();
    } catch (e) {
      this.toast.error("Bulk delete failed: " + (e as Error).message);
    } finally {
      this.isProcessing.set(false);
    }
  }
}
