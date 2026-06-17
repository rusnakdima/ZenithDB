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
import { DataStoreService } from "@shared/services/core/unified-storage.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ToastService } from "@services/toast.service";
import { RawResult } from "@shared/models/connection.config";
import { SqlEditorComponent } from "./sql-editor/sql-editor.component";
import { OutputConsoleComponent } from "./output-console/output-console.component";

import { QueryTab } from "@shared/models/query.model";
import { TabService } from "@shared/services/tab.service";
import { QueryExecutionService } from "@shared/services/query-execution.service";
import { formatSQL } from "@shared/utils/sql-formatter.utils";
import { findById } from "@shared/utils/array.utils";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { logger } from "../../services/logger.service";

@Component({
  selector: "app-workbench",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatIconModule, SqlEditorComponent, OutputConsoleComponent],
  templateUrl: "./workbench.view.html",
})
export class WorkbenchComponent implements OnDestroy {
  protected store = inject(DataStoreService);
  protected connState = inject(ConnectionStateService);
  protected toast = inject(ToastService);
  protected tabService = inject(TabService);
  private readonly queryExecution = inject(QueryExecutionService);
  private cdr = inject(ChangeDetectorRef);
  private dataflowLogger = inject(DataflowLoggerService);
  

  private readonly page = "Workbench";

  @ViewChild("splitContainer") splitContainer!: ElementRef<HTMLDivElement>;

  readonly tabs = this.tabService.tabs;
  readonly activeTabId = this.tabService.activeTabId;
  readonly activeTab = this.tabService.activeTab;

  editorHeight = signal(250);
  isResizing = false;

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
    logger.log("[WORKBENCH]", "User action: addTab");
    this.tabService.addTab();
  }

  closeTab(tabId: string, event?: MouseEvent) {
    logger.log("[WORKBENCH]", "User action: closeTab", { tabId });
    this.tabService.closeTab(tabId, event);
  }

  selectTab(tabId: string) {
    logger.log("[WORKBENCH]", "User action: selectTab", { tabId });
    this.tabService.selectTab(tabId);
  }

  updateQuery(query: string) {
    this.tabService.updateQuery(query);
  }

  async runCurrentTab() {
    const tab = this.activeTab();
    logger.log("[WORKBENCH]", "User action: runCurrentTab", {
      tabId: tab?.id,
      queryLength: tab?.query.length,
    });
    if (!tab || !tab.query.trim()) return;
    await this.queryExecution.executeWithTiming(tab.query);
  }

  runAllTabs() {
    logger.log("[WORKBENCH]", "User action: runAllTabs", { tabCount: this.tabs().length });
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
    try {
      const results = await this.store.executeRaw(tab.query);
      const executionTime = performance.now() - startTime;

      this.tabService.updateTab(tabId, {
        results,
        error: "",
        loading: false,
        executionTime,
        modified: false,
      });
    } catch (e: unknown) {
      const executionTime = performance.now() - startTime;
      const errorMessage = e instanceof Error ? e.message : "Query failed";
      this.tabService.updateTab(tabId, {
        error: errorMessage,
        loading: false,
        executionTime,
      });
    }
  }

  formatAllSQL() {
    logger.log("[WORKBENCH]", "User action: formatAllSQL");
    this.tabService.updateAllTabs({
      modified: true,
    });
    this.tabs().forEach((tab) => {
      this.tabService.updateTab(tab.id, { query: formatSQL(tab.query) });
    });
  }

  clearEditor() {
    logger.log("[WORKBENCH]", "User action: clearEditor");
    this.tabService.updateActiveTab({
      query: "",
      results: null,
      error: "",
      modified: false,
    });
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
    return tab.id;
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
