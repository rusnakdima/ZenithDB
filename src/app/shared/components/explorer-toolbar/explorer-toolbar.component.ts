import { Component, input, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { CollectionStats } from "@shared/models/connection.config";
import { FormatBytesPipe } from "@shared/pipes/format-bytes.pipe";
import { formatCompactNumber } from "@shared/utils/number.utils";
import { ExportMenuDropdownComponent } from "@shared/components/export-menu-dropdown/export-menu-dropdown.component";

@Component({
  selector: "app-explorer-toolbar",
  standalone: true,
  imports: [MatIconModule, FormatBytesPipe, ExportMenuDropdownComponent],
  templateUrl: "./explorer-toolbar.component.html",
})
export class ExplorerToolbarComponent {
  stats = input<CollectionStats | null>(null);
  treeCollapsed = input(false);
  showExportMenu = input(false);

  toggleTreeCollapse = output<void>();
  openCompareTables = output<void>();
  onImport = output<void>();
  toggleExportMenu = output<void>();
  onExport = output<"csv" | "json" | "sql">();

  formatDocumentCount = formatCompactNumber;
}
