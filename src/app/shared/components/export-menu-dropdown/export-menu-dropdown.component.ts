import { Component, input, output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
@Component({
  selector: "app-export-menu-dropdown",
  standalone: true,
  imports: [MatIconModule],
  templateUrl: "./export-menu-dropdown.component.html",
})
export class ExportMenuDropdownComponent {
  show = input(false);
  export = output<"csv" | "json" | "sql">();
  close = output<void>();
  onExport(format: "csv" | "json" | "sql") {
    this.export.emit(format);
    this.close.emit();
  }
  onClose() {
    this.close.emit();
  }
}
