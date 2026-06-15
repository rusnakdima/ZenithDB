import { Component, input, output, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { getLoggingService } from "@tauri-apps/logger";

@Component({
  selector: "app-bulk-action-bar",
  standalone: true,
  imports: [MatIconModule],
  templateUrl: "./bulk-action-bar.component.html",
})
export class BulkActionBarComponent {
  selectedCount = input<number>(0);
  export = output<void>();
  delete = output<void>();
  clearSelection = output<void>();
}
