import { Component, signal, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CollectionMeta } from "@shared/models/connection.config";

export type ViewMode = "grid" | "list" | "json";
export type BulkAction = "delete" | "export" | "custom";

export interface BulkActionOption {
  id: BulkAction;
  label: string;
  icon?: string;
}

@Component({
  selector: "app-action-bar",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./action-bar.component.html",
})
export class ActionBarComponent {
  collection = input.required<CollectionMeta>();
  filterPlaceholder = input<string>("Search...");
  filterValidationPattern = input<RegExp | null>(null);
  filterValidationMessage = input<string>("");

  filterChange = output<string>();
  bulkAction = output<BulkAction | { action: string; selected: any[] }>();
  viewChange = output<ViewMode>();
  refresh = output<void>();

  filter = signal("");
  viewMode = signal<ViewMode>("grid");
  showBulkMenu = signal(false);
  filterError = signal("");

  bulkActions: BulkActionOption[] = [
    { id: "delete", label: "Delete Selected" },
    { id: "export", label: "Export Selected" },
  ];

  applyFilter() {
    const pattern = this.filterValidationPattern();
    const value = this.filter();

    if (pattern && value && !pattern.test(value)) {
      this.filterError.set(this.filterValidationMessage() || "Invalid format");
      return;
    }

    this.filterError.set("");
    this.filterChange.emit(value);
  }

  clearFilter() {
    this.filter.set("");
    this.filterError.set("");
    this.filterChange.emit("");
  }

  onFilterInput(value: string) {
    if (this.filterError() && value === "") {
      this.filterError.set("");
    }
  }

  setViewMode(mode: ViewMode) {
    this.viewMode.set(mode);
    this.viewChange.emit(mode);
  }

  toggleBulkMenu() {
    this.showBulkMenu.update((v) => !v);
  }

  closeBulkMenu() {
    this.showBulkMenu.set(false);
  }

  performBulkAction(action: BulkAction) {
    this.bulkAction.emit(action);
    this.closeBulkMenu();
  }

  performRefresh() {
    this.refresh.emit();
  }
}