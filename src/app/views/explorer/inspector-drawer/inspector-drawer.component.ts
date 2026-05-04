import { Component, input, output, signal, computed, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ToastService } from "@services/toast.service";
import { ExportService } from "@shared/services/export.service";

@Component({
  selector: "app-inspector-drawer",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./inspector-drawer.component.html",
})
export class InspectorDrawerComponent {
  document = input.required<any>();
  close = output<void>();
  save = output<any>();
  delete = output<void>();

  private toast = inject(ToastService);
  private exportService = inject(ExportService);

  isEditing = signal(false);
  editText = signal("");
  isSaving = signal(false);
  jsonError = signal("");
  expandedPaths = signal<Set<string>>(new Set());
  showDeleteConfirm = signal(false);

  documentId = computed(() => {
    const doc = this.document();
    return doc?._id || doc?.id || "Unknown";
  });

  metadata = computed(() => {
    const doc = this.document();
    if (!doc) return [];
    return [
      { key: "_id", value: doc._id || doc.id || "N/A", isInternal: true },
      { key: "_createdAt", value: doc._createdAt || doc.createdAt || "N/A", isInternal: true },
      { key: "_updatedAt", value: doc._updatedAt || doc.updatedAt || "N/A", isInternal: true },
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
      const parsed = JSON.parse(this.editText());
      this.save.emit(parsed);
      this.toast.success("Document saved");
      this.isEditing.set(false);
    } catch (e: any) {
      this.jsonError.set("Invalid JSON: " + e.message);
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
    try {
      JSON.parse(this.editText());
      this.jsonError.set("");
      return true;
    } catch (e: any) {
      this.jsonError.set("Invalid JSON: " + e.message);
      return false;
    }
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
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success("Copied to clipboard");
    } catch {
      this.toast.error("Failed to copy");
    }
  }

  copyJson() {
    this.copyToClipboard(this.jsonPayload());
  }

  copyDocument() {
    this.copyToClipboard(JSON.stringify(this.document(), null, 2));
  }

  formatJsonLines(json: string): string[] {
    return json.split("\n");
  }

  getSyntaxHighlighting(json: string): string {
    const escaped = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    return escaped.replace(
      /("([^"\\]|\\.)*")\s*:|("([^"\\]|\\.)*")|(true|false)|(null)|(-?\d+\.?\d*)/g,
      (match, key, keyStr, str, bool, nul, num) => {
        if (key) {
          return `<span class="json-key">${keyStr || key}</span>:`;
        }
        if (str) {
          return `<span class="json-string">${str}</span>`;
        }
        if (bool) {
          return `<span class="json-boolean">${bool}</span>`;
        }
        if (nul) {
          return `<span class="json-null">${nul}</span>`;
        }
        if (num) {
          return `<span class="json-number">${num}</span>`;
        }
        return match;
      }
    );
  }

  highlightJsonLine(line: string): string {
    let result = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    result = result.replace(/("([^"\\]|\\.)*")\s*:/g, '<span class="json-key">$1</span>:');
    result = result.replace(/:\s*("([^"\\]|\\.)*")/g, ': <span class="json-string">$1</span>');
    result = result.replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>');
    result = result.replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
    result = result.replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>');

    return result;
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
}
