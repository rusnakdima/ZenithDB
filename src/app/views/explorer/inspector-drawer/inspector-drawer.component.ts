import { Component, input, output, signal, computed, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { ClipboardService } from "@shared/services/clipboard.service";
import { ToastService } from "@services/toast.service";
import { ExportService } from "@shared/services/export.service";
import { formatJsonLines, highlightJsonLine, safeJsonParse } from "@shared/utils/json.utils";

@Component({
  selector: "app-inspector-drawer",
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: "./inspector-drawer.component.html",
})
export class InspectorDrawerComponent {
  document = input.required<any>();
  close = output<void>();
  save = output<any>();
  delete = output<void>();

  private toast = inject(ToastService);
  private clipboard = inject(ClipboardService);
  private exportService = inject(ExportService);

  isEditing = signal(false);
  editText = signal("");
  isSaving = signal(false);
  jsonError = signal("");
  expandedPaths = signal<Set<string>>(new Set());
  showDeleteConfirm = signal(false);

  documentId = computed(() => {
    const doc = this.document();
    return doc?.["_id"] || doc?.["id"] || "Unknown";
  });

  metadata = computed(() => {
    const doc = this.document();
    if (!doc) return [];
    return [
      { key: "_id", value: doc["_id"] || doc["id"] || "N/A", isInternal: true },
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
    this.isEditing.set(false);
    this.showDeleteConfirm.set(false);
    this.close.emit();
  }

  async onSave() {
    if (!this.isValidJson()) return;
    this.isSaving.set(true);
    try {
      const parsed = safeJsonParse(this.editText(), undefined);
      if (parsed === undefined) {
        this.jsonError.set("Invalid JSON");
        this.isSaving.set(false);
        return;
      }
      this.save.emit(parsed);
      this.toast.success("Document saved");
      this.isEditing.set(false);
    } finally {
      this.isSaving.set(false);
    }
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

  startEdit() {
    this.editText.set(this.jsonPayload());
    this.isEditing.set(true);
    this.jsonError.set("");
  }

  cancelEdit() {
    this.isEditing.set(false);
    this.editText.set("");
    this.jsonError.set("");
  }

  resetEdit() {
    this.editText.set(this.jsonPayload());
    this.jsonError.set("");
  }

  isValidJson(): boolean {
    const parsed = safeJsonParse(this.editText(), undefined);
    if (parsed === undefined) {
      this.jsonError.set("Invalid JSON");
      return false;
    }
    this.jsonError.set("");
    return true;
  }

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
    try {
      await this.exportService.export({ format, filename: `document_${this.documentId()}` }, [doc]);
    } catch (error: any) {
      if (error.message !== "Export cancelled") {
        this.toast.error("Export failed");
      }
    }
  }

  formatJsonLines(json: string): string[] {
    return formatJsonLines(json);
  }

  highlightJsonLine(line: string): string {
    return highlightJsonLine(line);
  }
}
