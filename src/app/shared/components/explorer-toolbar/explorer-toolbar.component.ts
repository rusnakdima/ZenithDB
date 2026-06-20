import { Component, input, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { ExportMenuDropdownComponent } from "@shared/components/export-menu-dropdown/export-menu-dropdown.component";
@Component({
  selector: "app-explorer-toolbar",
  standalone: true,
  imports: [MatIconModule, ExportMenuDropdownComponent],
  templateUrl: "./explorer-toolbar.component.html",
})
export class ExplorerToolbarComponent {
  treeCollapsed = input(false);
  showExportMenu = input(false);
  toggleTreeCollapse = output<void>();
  openCompareTables = output<void>();
  onImport = output<void>();
  toggleExportMenu = output<void>();
  onExport = output<"csv" | "json" | "sql">();
  createDocument = output<void>();
}
