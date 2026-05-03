import {
  Component,
  inject,
  signal,
  computed,
  HostListener,
  OnInit,
  OnDestroy,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatePipe, TitleCasePipe } from "@angular/common";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ToastService } from "@services/toast.service";
import { RawResult } from "@shared/models/connection.config";

interface QueryTab {
  id: string;
  name: string;
  query: string;
  results: RawResult | null;
  error: string;
  loading: boolean;
  modified: boolean;
  executionTime: number;
}

interface HistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  success: boolean;
}

@Component({
  selector: "app-query-editor",
  standalone: true,
  imports: [FormsModule, DatePipe, TitleCasePipe],
  templateUrl: "./query-editor.component.html",
})
export class QueryEditorComponent implements OnInit, OnDestroy {
  protected db = inject(DatabaseService);
  protected connState = inject(ConnectionStateService);
  protected toast = inject(ToastService);

  tabs = signal<QueryTab[]>([
    this.createTab("Tab 1"),
  ]);
  activeTabId = signal<string>("Tab 1");
  showHistory = signal(false);
  history = signal<HistoryItem[]>([]);

  private eventCleanup: (() => void)[] = [];

  activeTab = computed(() => {
    return this.tabs().find((t) => t.id === this.activeTabId()) ?? this.tabs()[0];
  });

  private createTab(name: string): QueryTab {
    return {
      id: crypto.randomUUID(),
      name,
      query: "",
      results: null,
      error: "",
      loading: false,
      modified: false,
      executionTime: 0,
    };
  }

  ngOnInit() {
    this.loadHistory();
    this.setupKeyboardListeners();
  }

  ngOnDestroy(): void {
    this.eventCleanup.forEach(cleanup => cleanup());
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
    const stored = localStorage.getItem("zenith_query_history");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.history.set(
          parsed.map((h: any) => ({
            ...h,
            timestamp: new Date(h.timestamp),
          }))
        );
      } catch {
        this.history.set([]);
      }
    }
  }

  saveHistory() {
    const limited = this.history().slice(0, 20);
    localStorage.setItem(
      "zenith_query_history",
      JSON.stringify(limited.map((h) => ({ ...h, timestamp: h.timestamp.toISOString() })))
    );
  }

  addTab() {
    const tabs = this.tabs();
    const newTab = this.createTab(`Tab ${tabs.length + 1}`);
    this.tabs.set([...tabs, newTab]);
    this.activeTabId.set(newTab.id);
  }

  closeTab(tabId: string, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    const tabs = this.tabs();
    if (tabs.length === 1) return;

    const index = tabs.findIndex((t) => t.id === tabId);
    const newTabs = tabs.filter((t) => t.id !== tabId);
    this.tabs.set(newTabs);

    if (this.activeTabId() === tabId) {
      const newIndex = Math.min(index, newTabs.length - 1);
      this.activeTabId.set(newTabs[newIndex].id);
    }
  }

  selectTab(tabId: string) {
    this.activeTabId.set(tabId);
  }

  updateQuery(value: string) {
    const tab = this.activeTab();
    if (!tab) return;
    const updated = this.tabs().map((t) =>
      t.id === tab.id ? { ...t, query: value, modified: true } : t
    );
    this.tabs.set(updated);
  }

  async executeCurrentTab() {
    const tab = this.activeTab();
    if (!tab || !tab.query.trim()) return;

    this.tabs.set(
      this.tabs().map((t) =>
        t.id === tab.id ? { ...t, loading: true, error: "" } : t
      )
    );

    const startTime = performance.now();
    try {
      const results = await this.db.executeRaw(tab.query);
      const executionTime = performance.now() - startTime;

      this.tabs.set(
        this.tabs().map((t) =>
          t.id === tab.id
            ? { ...t, results, error: "", loading: false, executionTime, modified: false }
            : t
        )
      );

      this.addToHistory(tab.query, true);
      this.toast.success(`Query executed successfully (${executionTime.toFixed(0)}ms)`);
    } catch (e: any) {
      const executionTime = performance.now() - startTime;
      this.tabs.set(
        this.tabs().map((t) =>
          t.id === tab.id
            ? { ...t, error: e.message || "Query failed", loading: false, executionTime }
            : t
        )
      );

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
    const tab = this.activeTab();
    if (!tab) return;
    this.tabs.set(
      this.tabs().map((t) =>
        t.id === tab.id ? { ...t, query: item.query, modified: true } : t
      )
    );
  }

  deleteHistoryItem(id: string) {
    this.history.set(this.history().filter((h) => h.id !== id));
    this.saveHistory();
  }

  clearAllHistory() {
    this.history.set([]);
    localStorage.removeItem("zenith_query_history");
  }

  formatSQL() {
    const tab = this.activeTab();
    if (!tab) return;
    const formatted = this.formatSQLText(tab.query);
    this.tabs.set(
      this.tabs().map((t) =>
        t.id === tab.id ? { ...t, query: formatted, modified: true } : t
      )
    );
  }

  private formatSQLText(sql: string): string {
    const keywords = [
      "SELECT", "FROM", "WHERE", "AND", "OR", "INSERT", "INTO", "VALUES",
      "UPDATE", "SET", "DELETE", "CREATE", "TABLE", "DROP", "ALTER", "JOIN",
      "LEFT", "RIGHT", "INNER", "OUTER", "ON", "GROUP BY", "ORDER BY", "HAVING",
      "LIMIT", "OFFSET", "AS", "DISTINCT", "UNION", "ALL",
    ];

    let result = sql;
    keywords.forEach((kw) => {
      const regex = new RegExp(`\\b${kw}\\b`, "gi");
      result = result.replace(regex, kw);
    });

    result = result
      .replace(/\s+/g, " ")
      .replace(/,\s*/g, ", ")
      .replace(/\(\s*/g, "(")
      .replace(/\s*\)/g, ")");

    return result;
  }

  clearEditor() {
    const tab = this.activeTab();
    if (!tab) return;
    this.tabs.set(
      this.tabs().map((t) =>
        t.id === tab.id ? { ...t, query: "", results: null, error: "", modified: false } : t
      )
    );
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
      this.tabs.set(
        this.tabs().map((t) =>
          t.id === tab.id ? { ...t, query: newQuery, modified: true } : t
        )
      );
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

  exportResults() {
    const tab = this.activeTab();
    if (!tab?.results) return;

    const { columns, rows } = tab.results;
    const csv = [
      columns.join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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