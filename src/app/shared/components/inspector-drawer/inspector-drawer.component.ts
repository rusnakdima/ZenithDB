import { Component, input, output, signal, computed, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { ClipboardService } from "@shared/services/clipboard.service";
import { ToastService } from "@services/services.toast.service";
import { ExportService } from "@services/services.export.service";
import { formatJsonLines, highlightJsonLine } from "@shared/utils/json.utils";
import { RecordFormComponent } from "@features/data/record-form/record-form.component";
import { ColumnInfo, RowData } from "@entities/entities.connection.config";
import { getRecordId } from "@shared/utils/record.utils";

@Component({
  selector: "app-inspector-drawer",
  standalone: true,
  imports: [FormsModule, MatIconModule, RecordFormComponent],
  templateUrl: "./inspector-drawer.component.html",
})
export class InspectorDrawerComponent {
  document = input<RowData | null>(null);
  columns = input<ColumnInfo[]>([]);
  close = output<void>();
  delete = output<void>();
  edit = output<void>();
  save = output<RowData>();

  private toast = inject(ToastService);
  private clipboard = inject(ClipboardService);
  private exportService = inject(ExportService);

  jsonError = signal("");
  expandedPaths = signal<Set<string>>(new Set());
  showDeleteConfirm = signal(false);
  isEditMode = signal(false);

  documentId = computed(() => {
    const doc = this.document();
    if (!doc) return "New Document";
    return getRecordId(doc) ?? "Unknown";
  });

  isCreateMode = computed(() => {
    const doc = this.document();
    return !doc || (!doc["_id"] && !doc["id"]);
  });

  metadata = computed(() => {
    const doc = this.document();
    if (!doc) return [];
    return [
      { key: "_id", value: getRecordId(doc) ?? "N/A", isInternal: true },
      {
        key: "_createdAt",
        value: doc["_createdAt"] || doc["createdAt"] || "N/A",
        isInternal: true,
      },
      {
        key: "_updatedAt",
        value: doc["_updatedAt"] || doc["updatedAt"] || "N/A",
        isInternal: true,
      },
    ];
  });

  jsonPayload = computed(() => JSON.stringify(this.document(), null, 2));

  onBackdropClick(event: MouseEvent) {
    this.close.emit();
  }

  onDrawerClick(event: MouseEvent) {
    event.stopPropagation();
  }

  onClose() {
    this.showDeleteConfirm.set(false);
    this.close.emit();
  }

  onDelete() {
    this.showDeleteConfirm.set(true);
  }

  confirmDelete() {
    this.delete.emit();
    this.showDeleteConfirm.set(false);
    this.toast.success("Document deleted");
  }

  cancelDelete() {
    this.showDeleteConfirm.set(false);
  }

  onEdit() {
    this.isEditMode.set(true);
    this.edit.emit();
  }

  onCancelEdit() {
    this.isEditMode.set(false);
  }

  onFormSave(data: RowData) {
    this.isEditMode.set(false);
    this.save.emit(data);
  }

  onFormCancel() {
    this.isEditMode.set(false);
  }

  formatJsonLinesFn = (json: string): string[] => formatJsonLines(json);
  highlightJsonLineFn = (line: string): string => highlightJsonLine(line);

  togglePath(path: string) {
    this.expandedPaths.update((paths) => {
      const newSet = new Set(paths);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }

  isExpanded(path: string): boolean {
    return this.expandedPaths().has(path);
  }

  async copyToClipboard(text: string) {
    await this.clipboard.copyToClipboard(text, "Copied to clipboard");
  }

  copyJson() {
    this.copyToClipboard(this.jsonPayload());
  }

  copyDocument() {
    this.copyToClipboard(JSON.stringify(this.document(), null, 2));
  }

  async exportDocument(format: "json" | "csv") {
    const doc = this.document();
    if (!doc) return;
    try {
      await this.exportService.export({ format, filename: `document_${this.documentId()}` }, [doc]);
    } catch (error: unknown) {
      const err = error instanceof Error ? error.message : "Unknown error";
      if (err !== "Export cancelled") {
        this.toast.error("Export failed");
      }
    }
  }
}
