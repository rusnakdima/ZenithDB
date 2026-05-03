import { Component, inject, signal, Input, Output, EventEmitter } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ExportService, ExportFormat, FileFilter } from "@shared/services/export.service";
import { LoadingService } from "@shared/services/loading.service";

@Component({
  selector: "app-export-dialog",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./export-dialog.component.html",
})
export class ExportDialogComponent {
  @Input() data: any[] = [];
  @Input() title = "Export Data";
  @Input() defaultFormat: ExportFormat = "csv";
  @Input() defaultFilename = "export";
  @Input() showScopeSelection = true;
  @Output() close = new EventEmitter<void>();

  private exportService = inject(ExportService);
  private loading = inject(LoadingService);

  format = signal<ExportFormat>(this.defaultFormat);
  filename = signal(this.defaultFilename);
  scope = signal<"all" | "selected" | "page">("all");
  includeHeaders = signal(true);
  tableName = signal("data");

  isExporting = signal(false);
  progress = signal(0);

  formats: { value: ExportFormat; label: string }[] = [
    { value: "csv", label: "CSV (.csv)" },
    { value: "json", label: "JSON (.json)" },
    { value: "jsonl", label: "JSON Lines (.jsonl)" },
    { value: "sql", label: "SQL INSERT (.sql)" },
    { value: "markdown", label: "Markdown (.md)" },
  ];

  scopes: { value: "all" | "selected" | "page"; label: string }[] = [
    { value: "all", label: "All Data" },
    { value: "selected", label: "Selected Rows" },
    { value: "page", label: "Current Page" },
  ];

  onFormatChange(newFormat: ExportFormat) {
    this.format.set(newFormat);
    if (newFormat === "sql" && this.filename().endsWith(".csv")) {
      this.filename.set(this.filename().replace(/\.[^.]+$/, ".sql"));
    } else if (newFormat === "json" && !this.filename().endsWith(".json")) {
      this.filename.set(this.filename().replace(/\.[^.]+$/, ".json"));
    } else if (newFormat === "jsonl" && !this.filename().endsWith(".jsonl")) {
      this.filename.set(this.filename().replace(/\.[^.]+$/, ".jsonl"));
    } else if (newFormat === "markdown" && !this.filename().endsWith(".md")) {
      this.filename.set(this.filename().replace(/\.[^.]+$/, ".md"));
    }
  }

  getDataToExport(): any[] {
    return this.data;
  }

  async executeExport() {
    const data = this.getDataToExport();
    if (data.length === 0) {
      return;
    }

    this.isExporting.set(true);
    this.progress.set(0);

    try {
      const filename = this.filename();
      const format = this.format();

      this.progress.set(20);

      await this.exportService.export(
        {
          format,
          filename,
          includeHeaders: this.includeHeaders(),
          tableName: this.tableName(),
        },
        data
      );

      this.progress.set(100);
      this.close.emit();
    } catch (error: any) {
      if (error.message !== "Export cancelled") {
        console.error("Export error:", error);
      }
    } finally {
      this.isExporting.set(false);
      this.progress.set(0);
    }
  }

  cancelExport() {
    this.close.emit();
  }
}