import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  OnInit,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { ToastService } from "@services/toast.service";
import { CheckboxComponent } from "@shared/components/checkbox/checkbox.component";

@Component({
  selector: "app-filter-bar",
  standalone: true,
  imports: [FormsModule, MatIconModule, CheckboxComponent],
  templateUrl: "./filter-bar.component.html",
})
export class FilterBarComponent implements OnInit, OnChanges {
  @Input() filter = "";
  @Input() viewMode: "grid" | "json" = "grid";
  @Input() availableColumns: string[] = [];
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

  private readonly STORAGE_KEY = "zenithdb_filter_history";
  private readonly MAX_HISTORY = 10;

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

  ngOnInit() {
    this.loadHistory();
    this.localFilter = this.filter;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["availableColumns"] && this.availableColumns.length > 0) {
      const all = new Set<string>();
      this.availableColumns.forEach((c) => all.add(c));
      this.selectedColumns.set(all);
      this.columnsChange.emit(this.getSelectedColumns());
    }
  }

  loadHistory() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.filterHistory.set(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load filter history, continuing with defaults:", e);
    }
  }

  saveHistory() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.filterHistory()));
    } catch (e) {
      console.error("Failed to save filter history:", e);
    }
  }

  onFilterInput(value: string) {
    this.localFilter = value;
    this.filterChange.emit(value);
    this.validateFilter(value);
    this.updateAutocomplete(value);
  }

  private updateAutocomplete(value: string): void {
    const quoteCount = (value.match(/"/g) || []).length;
    if (quoteCount < 2) {
      this.showAutocomplete.set(false);
      return;
    }

    const lastQuoteIndex = value.lastIndexOf('"');
    const afterLastQuote = value.substring(lastQuoteIndex + 1);
    const lastPart = afterLastQuote.split(/[,\s:]/).pop() || "";
    const query = lastPart.toLowerCase();

    if (this.availableColumns.length > 0) {
      this.showHistory.set(false);
      const filtered = this.availableColumns.filter((col) => col.toLowerCase().includes(query));
      this.autocompleteFiltered.set(filtered.slice(0, 10));
      this.showAutocomplete.set(filtered.length > 0);
      this.selectedAutocompleteIndex.set(-1);
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
    const quoteCount = (value.match(/"/g) || []).length;
    if (quoteCount < 2) return;

    const lastQuoteIndex = value.lastIndexOf('"');
    const beforeQuote = value.substring(0, lastQuoteIndex + 1);
    const afterQuote = value.substring(lastQuoteIndex + 1);

    const match = afterQuote.match(/[,\s:]*$/);
    const prefix = match ? match[0] : "";
    const afterPrefix = afterQuote.substring(prefix.length);

    this.localFilter = beforeQuote + prefix + field + afterPrefix + " ";
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
    try {
      if (value.includes("{")) {
        JSON.parse(value);
      }
      this.isValidFilter.set(true);
      this.filterError.set("");
    } catch (e: any) {
      this.isValidFilter.set(false);
      this.filterError.set("Invalid JSON syntax");
    }
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
    console.log("[FilterBar] toggleColumn called:", col, "disabled:", this.isColumnDisabled(col));
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
    console.log("[FilterBar] emitting columnsChange with:", this.getSelectedColumns());
    this.columnsChange.emit(this.getSelectedColumns());
  }

  isColumnDisabled(col: string): boolean {
    return this.disabledColumns.includes(col);
  }

  selectAllColumns() {
    const all = new Set<string>();
    this.availableColumns.forEach((c) => all.add(c));
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
