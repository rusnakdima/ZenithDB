import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { BulkOperationsService, BulkUpdateRequest } from "./bulk-operations.service";
import { FieldInfo } from "@features/query/models";
import { ToastService } from "@services/toast.service";

@Component({
  selector: "app-bulk-update-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: "./bulk-update-dialog.component.html",
})
export class BulkUpdateDialogComponent implements OnInit {
  private readonly bulkOps = inject(BulkOperationsService);
  private readonly toast = inject(ToastService);

  @Input() collectionName = "";
  @Input() documentIds: string[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  availableFields = signal<FieldInfo[]>([]);
  selectedField = signal<string>("");
  newValue = signal<string>("");
  isProcessing = signal(false);

  recordCount = computed(() => this.documentIds.length);

  ngOnInit(): void {
    this.loadFields();
  }

  private async loadFields(): Promise<void> {
    const fields = await this.bulkOps.getFields(this.collectionName);
    this.availableFields.set(fields);
    if (fields.length > 0) {
      this.selectedField.set(fields[0].name);
    }
  }

  onFieldChange(fieldName: string): void {
    this.selectedField.set(fieldName);
  }

  onValueChange(value: string): void {
    this.newValue.set(value);
  }

  getValueForField(): unknown {
    const fieldName = this.selectedField();
    const fields = this.availableFields();
    const field = fields.find((f) => f.name === fieldName);
    const value = this.newValue();

    if (!field) return value;

    switch (field.type) {
      case "number":
        return Number(value);
      case "boolean":
        return value.toLowerCase() === "true";
      default:
        return value;
    }
  }

  getPreviewText(): string {
    return `Will update ${this.recordCount()} record${this.recordCount() !== 1 ? "s" : ""}`;
  }

  onCancel(): void {
    this.closed.emit();
  }

  async onConfirm(): Promise<void> {
    if (!this.selectedField()) {
      this.toast.error("Please select a field to update");
      return;
    }

    if (this.newValue() === "") {
      this.toast.error("Please enter a new value");
      return;
    }

    this.isProcessing.set(true);

    try {
      const request: BulkUpdateRequest = {
        collectionName: this.collectionName,
        documentIds: this.documentIds,
        field: this.selectedField(),
        value: this.getValueForField(),
      };

      await this.bulkOps.executeBulkUpdate(request);
      this.updated.emit();
      this.closed.emit();
    } catch (e) {
      this.toast.error("Bulk update failed: " + (e as Error).message);
    } finally {
      this.isProcessing.set(false);
    }
  }
}
