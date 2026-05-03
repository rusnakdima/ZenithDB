import {
  Component,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewInit,
  HostListener,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ToastService } from "@services/toast.service";
import { RawResult } from "@shared/models/connection.config";
import { SqlEditorComponent } from "./sql-editor/sql-editor.component";
import { OutputConsoleComponent } from "./output-console/output-console.component";

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

@Component({
  selector: "app-workbench",
  standalone: true,
  imports: [FormsModule, SqlEditorComponent, OutputConsoleComponent],
  templateUrl: "./workbench.component.html",
})
export class WorkbenchComponent implements AfterViewInit {
  protected db = inject(DatabaseService);
  protected connState = inject(ConnectionStateService);
  protected toast = inject(ToastService);

  @ViewChild("splitContainer") splitContainer!: ElementRef<HTMLDivElement>;

  tabs = signal<QueryTab[]>([this.createTab("Tab 1")]);
  activeTabId = signal<string>("Tab 1");

  editorHeight = signal(250);
  isResizing = false;

  activeTab = computed(() => {
    return this.tabs().find((t) => t.id === this.activeTabId()) ?? this.tabs()[0];
  });

  databases = ["ecommerce_main", "analytics_v1"];
  selectedDatabase = "ecommerce_main";

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

  ngAfterViewInit() {}

  @HostListener("window:keydown", ["$event"])
  handleKeydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      this.runCurrentTab();
    }
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

  updateQuery(query: string) {
    const tab = this.activeTab();
    if (!tab) return;
    this.tabs.set(
      this.tabs().map((t) =>
        t.id === tab.id ? { ...t, query, modified: true } : t
      )
    );
  }

  async runCurrentTab() {
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

      this.toast.success(`Query executed (${executionTime.toFixed(0)}ms)`);
    } catch (e: any) {
      const executionTime = performance.now() - startTime;
      this.tabs.set(
        this.tabs().map((t) =>
          t.id === tab.id
            ? { ...t, error: e.message || "Query failed", loading: false, executionTime }
            : t
        )
      );

      this.toast.error(e.message || "Query failed");
    }
  }

  runAllTabs() {
    this.tabs().forEach((tab) => {
      if (tab.query.trim() && !tab.loading) {
        this.executeTab(tab.id);
      }
    });
  }

  private async executeTab(tabId: string) {
    const tab = this.tabs().find((t) => t.id === tabId);
    if (!tab || !tab.query.trim()) return;

    this.tabs.set(
      this.tabs().map((t) =>
        t.id === tabId ? { ...t, loading: true, error: "" } : t
      )
    );

    const startTime = performance.now();
    try {
      const results = await this.db.executeRaw(tab.query);
      const executionTime = performance.now() - startTime;

      this.tabs.set(
        this.tabs().map((t) =>
          t.id === tabId
            ? { ...t, results, error: "", loading: false, executionTime, modified: false }
            : t
        )
      );
    } catch (e: any) {
      const executionTime = performance.now() - startTime;
      this.tabs.set(
        this.tabs().map((t) =>
          t.id === tabId
            ? { ...t, error: e.message || "Query failed", loading: false, executionTime }
            : t
        )
      );
    }
  }

  formatAllSQL() {
    const formatSQL = (sql: string): string => {
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

      return result.replace(/\s+/g, " ").replace(/,\s*/g, ", ").replace(/\(\s*/g, "(").replace(/\s*\)/g, ")");
    };

    this.tabs.set(
      this.tabs().map((t) => ({
        ...t,
        query: formatSQL(t.query),
        modified: true,
      }))
    );
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

  startResize(event: MouseEvent) {
    event.preventDefault();
    this.isResizing = true;

    const startY = event.clientY;
    const startHeight = this.editorHeight();

    const onMove = (e: MouseEvent) => {
      const delta = e.clientY - startY;
      const newHeight = Math.max(100, Math.min(600, startHeight + delta));
      this.editorHeight.set(newHeight);
    };

    const onUp = () => {
      this.isResizing = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  trackByTabId(_: number, tab: QueryTab) {
    return tab.id;
  }
}