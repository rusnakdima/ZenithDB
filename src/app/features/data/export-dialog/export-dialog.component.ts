import { Component, Input, Output, EventEmitter, signal, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { AppLoggerService } from "@shared/services/app-logger.service";

export type ExportFormat = "csv" | "json" | "jsonl" | "sql" | "markdown";

@Component({
  selector: "app-export-dialog",
  standalone: true,
  imports: [MatIconModule],
  templateUrl: "./export-dialog.component.html",
})
export class ExportDialogComponent {
  private logger = inject(AppLoggerService);

  @Input() visible = false;
  @Input() selectedCount = 0;
  @Input() totalCount = 0;

  @Output() exportData = new EventEmitter<ExportFormat>();
  @Output() close = new EventEmitter<void>();

  formats: { value: ExportFormat; label: string; icon: string }[] = [
    { value: "csv", label: "CSV", icon: "table_chart" },
    { value: "json", label: "JSON", icon: "data_object" },
    { value: "jsonl", label: "JSON Lines", icon: "format_list_bulleted" },
    { value: "sql", label: "SQL", icon: "storage" },
    { value: "markdown", label: "Markdown", icon: "article" },
  ];

  get dataCount(): number {
    return this.selectedCount > 0 ? this.selectedCount : this.totalCount;
  }

  onExport(format: ExportFormat) {
    this.logger.info("[DATA_GRID]", `Export requested: ${format.toUpperCase()}`);
    this.exportData.emit(format);
  }

  onClose() {
    this.close.emit();
  }
}
