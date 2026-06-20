import { Component, input, output, ChangeDetectionStrategy } from "@angular/core";
import { FilterBarComponent } from "@shared/components/filter-bar/filter-bar.component";
import { ColumnInfo } from "@entities/entities.connection.config";
@Component({
  selector: "app-explorer-filter-panel",
  standalone: true,
  imports: [FilterBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./explorer-filter-panel.component.html",
})
export class ExplorerFilterPanelComponent {
  availableColumns = input<ColumnInfo[]>([]);
  filterChange = output<string>();
  apply = output<void>();
  clear = output<void>();
  refresh = output<void>();
}
