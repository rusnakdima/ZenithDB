import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { FilterBarComponent } from "@shared/components/filter-bar/filter-bar.component";
import { DataStoreService } from "@services/core/data-store.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";

@Component({
  selector: "app-explorer-filter-panel",
  standalone: true,
  imports: [FilterBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./explorer-filter-panel.component.html",
})
export class ExplorerFilterPanelComponent {
  private store = inject(DataStoreService);
  private connectionState = inject(ConnectionStateService);
}
