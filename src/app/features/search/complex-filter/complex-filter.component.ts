import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { QueryGroupComponent } from "@features/query/visual-query-builder/query-group/query-group.component";
import { RawFilterEditorComponent } from "./raw-filter-editor.component";
import { FilterHistoryComponent } from "./filter-history.component";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { ConditionGroup, createEmptyGroup } from "@features/query/models";
import { FilterBuilderService } from "@features/query/services/filter-builder.service";
import { PersistentStorageService } from "@shared/services/persistent-storage.service";
import { ToastService } from "@services/toast.service";
import { FilterExpression } from "@shared/models/connection.config";

export interface NamedFilter {
  id: string;
  name: string;
  filter: FilterExpression;
  createdAt: number;
}

const NAMED_FILTERS_STORAGE_KEY = "zenithdb_named_filters";
const MAX_HISTORY_ITEMS = 10;

@Component({
  selector: "app-complex-filter",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    QueryGroupComponent,
    RawFilterEditorComponent,
    FilterHistoryComponent,
    ModalComponent,
  ],
  templateUrl: "./complex-filter.component.html",
})
export class ComplexFilterComponent implements OnInit {
  private readonly filterBuilder = inject(FilterBuilderService);
  private readonly storage = inject(PersistentStorageService);
  private readonly toast = inject(ToastService);

  @Input() collectionName = "";
  @Input() initialFilter: FilterExpression | null = null;

  @Output() filterChange = new EventEmitter<FilterExpression | null>();
  @Output() applyFilter = new EventEmitter<FilterExpression | null>();

  showRawEditor = signal(false);
  showHistory = signal(false);
  showSaveDialog = signal(false);

  rootGroup = signal<ConditionGroup>(createEmptyGroup());
  rawJson = signal("");
  saveFilterName = signal("");

  namedFilters = signal<NamedFilter[]>([]);

  ngOnInit(): void {
    this.loadNamedFilters();
    if (this.initialFilter) {
      const groups = this.filterBuilder.parseFilter(this.initialFilter);
      if (groups.length > 0) {
        this.rootGroup.set(groups[0]);
      }
    }
    this.updateRawJson();
  }

  onGroupChange(group: ConditionGroup): void {
    this.rootGroup.set(group);
    this.updateRawJson();
  }

  updateRawJson(): void {
    const filter = this.buildFilter();
    this.rawJson.set(JSON.stringify(filter, null, 2));
  }

  buildFilter(): FilterExpression | null {
    return this.filterBuilder.buildFilter([this.rootGroup()]);
  }

  toggleRawEditor(): void {
    this.showRawEditor.update((v) => !v);
  }

  toggleHistory(): void {
    this.showHistory.update((v) => !v);
  }

  onRawJsonChange(json: string): void {
    this.rawJson.set(json);
  }

  onRawJsonApply(json: string): void {
    try {
      const parsed = JSON.parse(json);
      const groups = this.filterBuilder.parseFilter(parsed);
      if (groups.length > 0) {
        this.rootGroup.set(groups[0]);
        this.filterChange.emit(this.buildFilter());
        this.toast.success("Filter applied from JSON");
      } else {
        this.toast.error("Invalid filter structure");
      }
    } catch (e) {
      this.toast.error("Invalid JSON: " + (e as Error).message);
    }
  }

  onRawJsonValidChange(isValid: boolean): void {}

  applyCurrentFilter(): void {
    const filter = this.buildFilter();
    this.applyFilter.emit(filter);
    this.addToHistory(filter);
  }

  clearFilter(): void {
    this.rootGroup.set(createEmptyGroup());
    this.updateRawJson();
    this.filterChange.emit(null);
  }

  private addToHistory(filter: FilterExpression | null): void {
    if (!filter) return;

    const history = this.storage.getFilterHistory();
    const jsonStr = JSON.stringify(filter);

    const existing = history.indexOf(jsonStr);
    if (existing !== -1) {
      history.splice(existing, 1);
    }

    history.unshift(jsonStr);

    if (history.length > MAX_HISTORY_ITEMS) {
      history.pop();
    }

    this.storage.setFilterHistory(history);
  }

  onHistorySelect(filter: FilterExpression): void {
    const groups = this.filterBuilder.parseFilter(filter);
    if (groups.length > 0) {
      this.rootGroup.set(groups[0]);
      this.updateRawJson();
      this.filterChange.emit(filter);
    }
    this.showHistory.set(false);
  }

  onHistoryDelete(filter: FilterExpression): void {
    const history = this.storage.getFilterHistory();
    const jsonStr = JSON.stringify(filter);
    const index = history.indexOf(jsonStr);
    if (index !== -1) {
      history.splice(index, 1);
      this.storage.setFilterHistory(history);
    }
  }

  openSaveDialog(): void {
    this.saveFilterName.set("");
    this.showSaveDialog.set(true);
  }

  closeSaveDialog(): void {
    this.showSaveDialog.set(false);
  }

  saveNamedFilter(): void {
    const name = this.saveFilterName().trim();
    if (!name) {
      this.toast.error("Please enter a filter name");
      return;
    }

    const filter = this.buildFilter();
    if (!filter) {
      this.toast.error("Cannot save empty filter");
      return;
    }

    const namedFilter: NamedFilter = {
      id: crypto.randomUUID(),
      name,
      filter,
      createdAt: Date.now(),
    };

    this.namedFilters.update((filters) => [...filters, namedFilter]);
    this.saveNamedFilters();
    this.showSaveDialog.set(false);
    this.toast.success(`Filter "${name}" saved`);
  }

  applyNamedFilter(namedFilter: NamedFilter): void {
    const groups = this.filterBuilder.parseFilter(namedFilter.filter);
    if (groups.length > 0) {
      this.rootGroup.set(groups[0]);
      this.updateRawJson();
      this.filterChange.emit(namedFilter.filter);
      this.applyFilter.emit(namedFilter.filter);
    }
  }

  deleteNamedFilter(id: string): void {
    this.namedFilters.update((filters) => filters.filter((f) => f.id !== id));
    this.saveNamedFilters();
    this.toast.success("Filter deleted");
  }

  private loadNamedFilters(): void {
    const stored = this.storage.get<NamedFilter[]>(NAMED_FILTERS_STORAGE_KEY);
    if (stored) {
      this.namedFilters.set(stored);
    }
  }

  private saveNamedFilters(): void {
    this.storage.set(NAMED_FILTERS_STORAGE_KEY, this.namedFilters());
  }
}
