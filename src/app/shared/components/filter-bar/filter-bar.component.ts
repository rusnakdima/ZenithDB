import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  HostListener,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { ToastService } from "@services/toast.service";
import { CheckboxComponent } from "@shared/components/checkbox/checkbox.component";
import { PersistentStorageService } from "@shared/services/persistent-storage.service";
import { safeJsonParse } from "@shared/utils/json.utils";

@Component({
  selector: "app-filter-bar",
  standalone: true,
  imports: [FormsModule, MatIconModule, CheckboxComponent],
  templateUrl: "./filter-bar.component.html",
})
export class FilterBarComponent implements OnInit, OnChanges, OnDestroy {
  private localStorage = new PersistentStorageService();
  @Input() filter = "";
  @Input() viewMode: "grid" | "json" = "grid";
  @Input() availableColumns: { name: string; data_type: string }[] = [];
  @Input() disabledColumns: string[] = [];

  @Output() filterChange = new EventEmitter<string>();
  @Output() apply = new EventEmitter<void>();
  @Output() clear = new EventEmitter<void>();
  @Output() export = new EventEmitter<"csv" | "json" | "sql">();
  @Output() toggleView = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();
  @Output() columnsChange = new EventEmitter<string[]>();

  localFilter = "";
  filterHistory = signal<string[]>([]);
  showHistory = signal(false);
  showExportMenu = signal(false);
  showColumnChooser = signal(false);
  selectedColumns = signal<Set<string>>(new Set());
  isValidFilter = signal(true);
  filterError = signal("");
  showAutocomplete = signal(false);
  autocompleteFiltered = signal<string[]>([]);
  selectedAutocompleteIndex = signal(-1);
  private readonly MAX_HISTORY = 10;
  private readonly FILTER_DEBOUNCE_MS = 300;
  private filterDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private autocompleteTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly OPERATORS = [
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "contains",
    "startsWith",
    "endsWith",
    "in",
    "notIn",
  ];

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: MouseEvent) {
    this.closeDropdowns(event);
  }

  ngOnInit() {
    this.loadHistory();
    this.localFilter = this.filter;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["availableColumns"] && this.availableColumns.length > 0) {
      const all = new Set<string>();
      this.availableColumns.forEach((c) => all.add(c.name));
      this.selectedColumns.set(all);
      this.columnsChange.emit(this.getSelectedColumns());
    }
  }

  loadHistory() {
    try {
      const history = this.localStorage.getFilterHistory();
      if (history.length > 0) {
        this.filterHistory.set(history);
      }
    } catch (e) {
      console.warn("Failed to load filter history, continuing with defaults:", e);
    }
  }

  saveHistory() {
    try {
      this.localStorage.setFilterHistory(this.filterHistory());
    } catch (e) {
      console.warn("Failed to save filter history:", e);
    }
  }

  onFilterInput(value: string) {
    this.localFilter = value;
    this.validateFilter(value);

    if (this.autocompleteTimeout) {
      clearTimeout(this.autocompleteTimeout);
    }

    this.autocompleteTimeout = setTimeout(() => {
      this.updateAutocompleteSuggestions(value);
    }, 200);

    if (this.filterDebounceTimeout) {
      clearTimeout(this.filterDebounceTimeout);
    }

    this.filterDebounceTimeout = setTimeout(() => {
      this.filterChange.emit(value);
    }, this.FILTER_DEBOUNCE_MS);
  }

  private updateAutocompleteSuggestions(value: string): void {
    if (!value.trim()) {
      this.showAutocomplete.set(false);
      return;
    }

    const parts = value.split(/[\s:]+/);
    const lastPart = parts[parts.length - 1].toLowerCase();

    if (lastPart.length > 0) {
      const suggestions = this.availableColumns
        .filter((col) => col.name.toLowerCase().includes(lastPart))
        .slice(0, 10)
        .map((col) => `${col.name} (${col.data_type})`);

      this.autocompleteFiltered.set(suggestions);
      this.showAutocomplete.set(suggestions.length > 0);
    } else {
      this.showAutocomplete.set(false);
    }
  }

  onAutocompleteKeydown(event: KeyboardEvent): void {
    if (!this.showAutocomplete()) return;

    const items = this.autocompleteFiltered();

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.selectedAutocompleteIndex.update((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this.selectedAutocompleteIndex.update((i) => Math.max(i - 1, -1));
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      if (this.selectedAutocompleteIndex() >= 0) {
        this.selectAutocomplete(items[this.selectedAutocompleteIndex()]);
      }
    } else if (event.key === "Escape") {
      this.showAutocomplete.set(false);
    }
  }

  selectAutocomplete(field: string): void {
    const value = this.localFilter;
    const lastSpaceIndex = value.lastIndexOf(" ");
    const beforeSpace = lastSpaceIndex >= 0 ? value.substring(0, lastSpaceIndex + 1) : "";
    const afterSpace = lastSpaceIndex >= 0 ? value.substring(lastSpaceIndex + 1) : value;

    const match = afterSpace.match(/^([\s:]*)/);
    const prefix = match ? match[1] : "";
    const afterPrefix = afterSpace.substring(prefix.length);

    this.localFilter = beforeSpace + prefix + field + afterPrefix + " ";
    this.filterChange.emit(this.localFilter);
    this.showAutocomplete.set(false);
    this.selectedAutocompleteIndex.set(-1);
  }

  validateFilter(value: string) {
    if (!value.trim()) {
      this.isValidFilter.set(true);
      this.filterError.set("");
      return;
    }
    if (value.includes("{")) {
      const parsed = safeJsonParse<object>(value, {} as object);
      if (Object.keys(parsed).length === 0 && !value.trim().startsWith("{")) {
        this.isValidFilter.set(false);
        this.filterError.set("Invalid JSON syntax");
        return;
      }
    }
    this.isValidFilter.set(true);
    this.filterError.set("");
  }

  onApply() {
    if (!this.isValidFilter()) return;
    this.addToHistory(this.localFilter);
    this.filterChange.emit(this.localFilter);
    this.apply.emit();
    this.showHistory.set(false);
  }

  onClear() {
    this.localFilter = "";
    this.isValidFilter.set(true);
    this.filterError.set("");
    this.filterChange.emit("");
    this.clear.emit();
  }

  onToggleView() {
    this.toggleView.emit();
  }

  onRefresh() {
    this.refresh.emit();
  }

  addToHistory(filter: string) {
    if (!filter.trim()) return;
    const history = this.filterHistory();
    const filtered = history.filter((f) => f !== filter);
    const updated = [filter, ...filtered].slice(0, this.MAX_HISTORY);
    this.filterHistory.set(updated);
    this.saveHistory();
  }

  useHistoryItem(filter: string) {
    this.localFilter = filter;
    this.filterChange.emit(filter);
    this.validateFilter(filter);
    this.showHistory.set(false);
  }

  clearHistory() {
    this.filterHistory.set([]);
    this.saveHistory();
  }

  toggleHistory() {
    this.showHistory.update((v) => !v);
    this.showExportMenu.set(false);
    this.showColumnChooser.set(false);
  }

  toggleExportMenu() {
    this.showExportMenu.update((v) => !v);
    this.showHistory.set(false);
    this.showColumnChooser.set(false);
  }

  toggleColumnChooser() {
    this.showColumnChooser.update((v) => !v);
    this.showHistory.set(false);
    this.showExportMenu.set(false);
  }

  onExport(format: "csv" | "json" | "sql") {
    this.export.emit(format);
    this.showExportMenu.set(false);
  }

  onColumnsChange(columns: string[]) {
    this.selectedColumns.set(new Set(columns));
    this.columnsChange.emit(columns);
  }

  initColumns(columns: string[]) {
    const selected = new Set<string>();
    columns.forEach((c) => selected.add(c));
    this.selectedColumns.set(selected);
  }

  toggleColumn(col: string) {
    if (this.isColumnDisabled(col)) return;
    this.selectedColumns.update((selected) => {
      const newSet = new Set(selected);
      if (newSet.has(col)) {
        newSet.delete(col);
      } else {
        newSet.add(col);
      }
      return newSet;
    });
    this.columnsChange.emit(this.getSelectedColumns());
  }

  isColumnDisabled(col: string): boolean {
    return this.disabledColumns.includes(col);
  }

  selectAllColumns() {
    const all = new Set<string>();
    this.availableColumns.forEach((c) => all.add(c.name));
    this.selectedColumns.set(all);
    this.columnsChange.emit(this.getSelectedColumns());
  }

  deselectAllColumns() {
    this.selectedColumns.set(new Set());
    this.columnsChange.emit([]);
  }

  getSelectedColumns(): string[] {
    return Array.from(this.selectedColumns());
  }

  ngOnDestroy() {
    if (this.filterDebounceTimeout) {
      clearTimeout(this.filterDebounceTimeout);
    }
    if (this.autocompleteTimeout) {
      clearTimeout(this.autocompleteTimeout);
    }
  }

  closeDropdowns(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".dropdown-container")) {
      this.showHistory.set(false);
      this.showExportMenu.set(false);
      this.showColumnChooser.set(false);
      this.showAutocomplete.set(false);
    }
  }
}
