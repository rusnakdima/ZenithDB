import {
  Component,
  inject,
  signal,
  ViewChild,
  ElementRef,
  HostListener,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { DataStoreService } from "@core/services/unified-storage.service";
import { ConnectionStateService } from "@services/services.connection-state.service";
import { ToastService } from "@services/services.toast.service";
import { RawResult } from "@entities/entities.connection.config";
import { SqlEditorComponent } from "./sql-editor/sql-editor.component";
import { OutputConsoleComponent } from "./output-console/output-console.component";
import { QueryTab } from "@entities/entities.query.entity";
import { TabService } from "@services/services.tab.service";
import { QueryExecutionService } from "@services/services.query-execution.service";
import { formatSQL } from "@shared/utils/sql-formatter.utils";
import { findById } from "@shared/utils/array.utils";
import { QueryHistoryService } from "@features/query/history/query-history.service";
import { QueryHistoryComponent } from "@features/query/history/query-history.component";
@Component({
  selector: "app-workbench",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatIconModule, SqlEditorComponent, OutputConsoleComponent, QueryHistoryComponent],
  templateUrl: "./workbench.view.html",
})
export class WorkbenchComponent implements OnDestroy {
  protected store = inject(DataStoreService);
  protected connState = inject(ConnectionStateService);
  protected toast = inject(ToastService);
  protected tabService = inject(TabService);
  private readonly queryExecution = inject(QueryExecutionService);
  private readonly historyService = inject(QueryHistoryService);
  private cdr = inject(ChangeDetectorRef);
  private readonly page = "Workbench";
  @ViewChild("splitContainer") splitContainer!: ElementRef<HTMLDivElement>;
  readonly tabs = this.tabService.tabs;
  readonly activeTabId = this.tabService.activeTabId;
  readonly activeTab = this.tabService.activeTab;
  editorHeight = signal(250);
  mobileView = signal<"editor" | "results">("editor");
  isResizing = false;
  showHistoryPanel = signal(false);
  private boundOnMove: ((e: MouseEvent) => void) | null = null;
  private boundOnUp: (() => void) | null = null;
  @HostListener("window:keydown", ["$event"])
  handleKeydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      this.runCurrentTab();
    }
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
  setMobileView(view: "editor" | "results") {
    this.mobileView.set(view);
  }
  updateQuery(query: string) {
    this.tabService.updateQuery(query);
  }
  async runCurrentTab() {
    const tab = this.activeTab();
    if (!tab || !tab.query.trim()) return;
    await this.queryExecution.executeWithTiming(tab.query);
  }
  runAllTabs() {
    this.tabs().forEach((tab) => {
      if (tab.query.trim() && !tab.loading) {
        this.executeTab(tab.id);
      }
    });
  }
  private async executeTab(tabId: string) {
    const tab = findById(this.tabs(), tabId);
    if (!tab || !tab.query.trim()) return;
    this.tabService.updateTab(tabId, { loading: true, error: "" });
    const startTime = performance.now();
    let success = false;
    let rowsReturned = 0;
    try {
      const results = await this.store.executeRaw(tab.query);
      const executionTime = performance.now() - startTime;
      success = true;
      rowsReturned = results?.rows?.length ?? 0;
      this.tabService.updateTab(tabId, {
        results,
        error: "",
        loading: false,
        executionTime,
        modified: false,
      });
      this.historyService.addQuery({
        query: tab.query,
        duration: executionTime,
        rowsReturned,
        success: true,
      });
    } catch (e: unknown) {
      const executionTime = performance.now() - startTime;
      const errorMessage = e instanceof Error ? e.message : "Query failed";
      this.tabService.updateTab(tabId, {
        error: errorMessage,
        loading: false,
        executionTime,
      });
      this.historyService.addQuery({
        query: tab.query,
        duration: executionTime,
        rowsReturned: 0,
        success: false,
      });
    }
  }
  formatAllSQL() {
    this.tabService.updateAllTabs({
      modified: true,
    });
    this.tabs().forEach((tab) => {
      this.tabService.updateTab(tab.id, { query: formatSQL(tab.query) });
    });
  }
  clearEditor() {
    this.tabService.updateActiveTab({
      query: "",
      results: null,
      error: "",
      modified: false,
    });
  }
  toggleHistoryPanel() {
    this.showHistoryPanel.set(!this.showHistoryPanel());
  }
  closeHistoryPanel() {
    this.showHistoryPanel.set(false);
  }
  onHistoryLoadQuery(query: string) {
    this.tabService.updateActiveTab({ query, modified: true });
    this.showHistoryPanel.set(false);
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
      document.removeEventListener("mousemove", this.boundOnMove!);
      document.removeEventListener("mouseup", this.boundOnUp!);
    };
    this.boundOnMove = onMove;
    this.boundOnUp = onUp;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }
  trackByTabId(_: number, tab: QueryTab) {
    return tab.id || String(_);
  }
  ngOnDestroy() {
    this.isResizing = false;
    if (this.boundOnMove) {
      document.removeEventListener("mousemove", this.boundOnMove);
      this.boundOnMove = null;
    }
    if (this.boundOnUp) {
      document.removeEventListener("mouseup", this.boundOnUp);
      this.boundOnUp = null;
    }
  }
}
