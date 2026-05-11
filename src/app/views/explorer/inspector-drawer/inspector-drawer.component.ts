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
  delete = output<void>();

  private toast = inject(ToastService);
  private clipboard = inject(ClipboardService);
  private exportService = inject(ExportService);

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

  resetEdit() {}

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
