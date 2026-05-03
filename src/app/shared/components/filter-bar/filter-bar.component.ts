import { Component, Input, Output, EventEmitter, signal, computed, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ToastService } from "@services/toast.service";

@Component({
  selector: "app-filter-bar",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./filter-bar.component.html",
})
export class FilterBarComponent implements OnInit {
  @Input() filter = "";
  @Input() viewMode: "grid" | "json" = "grid";
  @Input() availableColumns: string[] = [];

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

  private readonly STORAGE_KEY = "zenithdb_filter_history";
  private readonly MAX_HISTORY = 10;

  ngOnInit() {
    this.loadHistory();
    this.localFilter = this.filter;
  }

  loadHistory() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.filterHistory.set(JSON.parse(stored));
      }
    } catch {}
  }

  saveHistory() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.filterHistory()));
    } catch {}
  }

  onFilterInput(value: string) {
    this.localFilter = value;
    this.filterChange.emit(value);
    this.validateFilter(value);
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
    const filtered = history.filter(f => f !== filter);
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
    this.showHistory.update(v => !v);
    this.showExportMenu.set(false);
    this.showColumnChooser.set(false);
  }

  toggleExportMenu() {
    this.showExportMenu.update(v => !v);
    this.showHistory.set(false);
    this.showColumnChooser.set(false);
  }

  toggleColumnChooser() {
    this.showColumnChooser.update(v => !v);
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
    columns.forEach(c => selected.add(c));
    this.selectedColumns.set(selected);
  }

  toggleColumn(col: string) {
    this.selectedColumns.update(selected => {
      const newSet = new Set(selected);
      if (newSet.has(col)) {
        newSet.delete(col);
      } else {
        newSet.add(col);
      }
      return newSet;
    });
  }

  selectAllColumns() {
    const all = new Set<string>();
    this.availableColumns.forEach(c => all.add(c));
    this.selectedColumns.set(all);
  }

  deselectAllColumns() {
    this.selectedColumns.set(new Set());
  }

  getSelectedColumns(): string[] {
    return Array.from(this.selectedColumns());
  }

  closeDropdowns(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-container')) {
      this.showHistory.set(false);
      this.showExportMenu.set(false);
      this.showColumnChooser.set(false);
    }
  }
}