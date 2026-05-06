import { Component, inject, signal, HostListener, OnInit, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatePipe } from "@angular/common";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ToastService } from "@services/toast.service";
import { StorageService } from "@services/core/storage.service";
import { ExportService } from "@shared/services/export.service";
import { RawResult } from "@shared/models/connection.config";
import { formatSQL } from "@shared/utils";

import { QueryTab } from "@shared/models/query.model";
import { TabService } from "@shared/services/tab.service";

interface HistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  success: boolean;
}

@Component({
  selector: "app-query-editor",
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: "./query-editor.component.html",
})
export class QueryEditorComponent implements OnInit, OnDestroy {
  protected db = inject(DatabaseService);
  protected connState = inject(ConnectionStateService);
  protected toast = inject(ToastService);
  protected storage = inject(StorageService);
  protected exportService = inject(ExportService);
  protected tabService = inject(TabService);

  readonly tabs = this.tabService.tabs;
  readonly activeTabId = this.tabService.activeTabId;
  showHistory = signal(false);
  history = signal<HistoryItem[]>([]);

  private eventCleanup: (() => void)[] = [];

  activeTab = this.tabService.activeTab;

  ngOnInit() {
    this.loadHistory();
    this.setupKeyboardListeners();
  }

  ngOnDestroy(): void {
    this.eventCleanup.forEach((cleanup) => cleanup());
  }

  private setupKeyboardListeners(): void {
    const formatHandler = () => this.formatSQL();
    const clearHandler = () => this.clearEditor();
    const duplicateHandler = () => this.duplicateLine();

    document.addEventListener("zenith:format-sql", formatHandler);
    document.addEventListener("zenith:clear-editor", clearHandler);
    document.addEventListener("zenith:duplicate-line", duplicateHandler);

    this.eventCleanup.push(() => {
      document.removeEventListener("zenith:format-sql", formatHandler);
      document.removeEventListener("zenith:clear-editor", clearHandler);
      document.removeEventListener("zenith:duplicate-line", duplicateHandler);
    });
  }

  @HostListener("window:keydown", ["$event"])
  handleKeydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      this.executeCurrentTab();
    }

    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      this.formatSQL();
    }

    if (event.ctrlKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      this.clearEditor();
    }

    if (event.ctrlKey && event.key.toLowerCase() === "d") {
      event.preventDefault();
      this.duplicateLine();
    }
  }

  loadHistory() {
    const stored = this.storage.getItem<any[]>("zenith_query_history");
    if (stored) {
      this.history.set(
        stored.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        }))
      );
    } else {
      this.history.set([]);
    }
  }

  saveHistory() {
    const limited = this.history().slice(0, 20);
    this.storage.setItem(
      "zenith_query_history",
      limited.map((h) => ({ ...h, timestamp: h.timestamp.toISOString() }))
    );
  }

  addTab() {
    this.tabService.addTab();
  }

  closeTab(tabId: string, event?: MouseEvent) {
    this.tabService.closeTab(tabId, event);
  }

  selectTab(tabId: string) {
    this.tabService.selectTab(tabId);
  }

  updateQuery(value: string) {
    this.tabService.updateQuery(value);
  }

  async executeCurrentTab() {
    const tab = this.activeTab();
    if (!tab || !tab.query.trim()) return;

    this.tabService.updateActiveTab({ loading: true, error: "" });

    const startTime = performance.now();
    try {
      const results = await this.db.executeRaw(tab.query);
      const executionTime = performance.now() - startTime;

      this.tabService.updateActiveTab({
        results,
        error: "",
        loading: false,
        executionTime,
        modified: false,
      });

      this.addToHistory(tab.query, true);
      this.toast.success(`Query executed successfully (${executionTime.toFixed(0)}ms)`);
    } catch (e: any) {
      const executionTime = performance.now() - startTime;
      this.tabService.updateActiveTab({
        error: e.message || "Query failed",
        loading: false,
        executionTime,
      });

      this.addToHistory(tab.query, false, e.message);
      this.toast.error(e.message || "Query failed");
    }
  }

  addToHistory(query: string, success: boolean, errorMsg?: string) {
    const item: HistoryItem = {
      id: crypto.randomUUID(),
      query,
      timestamp: new Date(),
      success,
    };
    const newHistory = [item, ...this.history().filter((h) => h.query !== query)].slice(0, 20);
    this.history.set(newHistory);
    this.saveHistory();
  }

  loadFromHistory(item: HistoryItem) {
    this.tabService.updateActiveTab({ query: item.query, modified: true });
  }

  deleteHistoryItem(id: string) {
    this.history.set(this.history().filter((h) => h.id !== id));
    this.saveHistory();
  }

  clearAllHistory() {
    this.history.set([]);
    this.storage.removeItem("zenith_query_history");
  }

  formatSQL() {
    const tab = this.activeTab();
    if (!tab) return;
    const formatted = formatSQL(tab.query);
    this.tabService.updateActiveTab({ query: formatted, modified: true });
  }

  clearEditor() {
    this.tabService.updateActiveTab({
      query: "",
      results: null,
      error: "",
      modified: false,
    });
  }

  duplicateLine(): void {
    const tab = this.activeTab();
    if (!tab) return;
    const lines = tab.query.split("\n");
    const cursorPosition = this.getCursorPosition();
    const lineIndex = this.getLineIndexFromPosition(lines, cursorPosition);

    if (lineIndex >= 0 && lineIndex < lines.length) {
      const duplicatedLine = lines[lineIndex];
      lines.splice(lineIndex + 1, 0, duplicatedLine);
      const newQuery = lines.join("\n");
      this.tabService.updateActiveTab({ query: newQuery, modified: true });
    }
  }

  private getCursorPosition(): number {
    const textarea = document.querySelector("app-query-editor textarea") as HTMLTextAreaElement;
    return textarea?.selectionStart ?? 0;
  }

  private getLineIndexFromPosition(lines: string[], position: number): number {
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      charCount += lines[i].length + 1;
      if (charCount > position) {
        return i;
      }
    }
    return lines.length - 1;
  }

  async exportResults() {
    const tab = this.activeTab();
    if (!tab?.results) return;

    const { columns, rows } = tab.results;
    const data = rows.map((r: unknown[]) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col: string, i: number) => {
        obj[col] = r[i];
      });
      return obj;
    });

    await this.exportService.export(
      { format: "csv", filename: `query_results_${Date.now()}.csv` },
      data
    );
  }

  trackByTabId(_: number, tab: QueryTab) {
    return tab.id;
  }

  trackByHistoryId(_: number, item: HistoryItem) {
    return item.id;
  }

  hasAffectedRows(): boolean {
    const results = this.activeTab()?.results;
    return !!(results && results.affected_rows > 0);
  }
}
