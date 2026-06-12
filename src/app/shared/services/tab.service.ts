import { Injectable, signal, computed, inject } from "@angular/core";
import { QueryTab } from "@shared/models/query.model";
import { findById } from "@shared/utils/array.utils";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";

@Injectable({ providedIn: "root" })
export class TabService {
  private readonly tabsSignal = signal<QueryTab[]>([this.createTab("Tab 1")]);
  private readonly activeTabIdSignal = signal<string>("Tab 1");
  private readonly logger = inject(DataflowLoggerService, { optional: true });

  readonly tabs = this.tabsSignal.asReadonly();
  readonly activeTabId = this.activeTabIdSignal.asReadonly();
  readonly activeTab = computed(() => {
    return findById(this.tabs(), this.activeTabIdSignal()) ?? this.tabs()[0];
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

  addTab(): void {
    const startTime = performance.now();
    const tabs = this.tabs();
    const newTab = this.createTab(`Tab ${tabs.length + 1}`);
    this.tabsSignal.set([...tabs, newTab]);
    this.activeTabIdSignal.set(newTab.id);
    this.logger?.logUserAction("workbench", "addTab", {
      tabId: newTab.id,
      tabCount: tabs.length + 1,
    });
  }

  closeTab(tabId: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    const startTime = performance.now();
    const tabs = this.tabs();
    if (tabs.length === 1) return;

    const index = tabs.findIndex((t) => t.id === tabId);
    const newTabs = tabs.filter((t) => t.id !== tabId);
    this.tabsSignal.set(newTabs);

    if (this.activeTabIdSignal() === tabId) {
      const newIndex = Math.min(index, newTabs.length - 1);
      this.activeTabIdSignal.set(newTabs[newIndex].id);
    }
    this.logger?.logUserAction("workbench", "closeTab", { tabId, remainingTabs: newTabs.length });
  }

  selectTab(tabId: string): void {
    const startTime = performance.now();
    this.activeTabIdSignal.set(tabId);
    this.logger?.logUserAction("workbench", "selectTab", { tabId });
  }

  updateQuery(query: string): void {
    const startTime = performance.now();
    this.tabsSignal.update((tabs) =>
      tabs.map((t) => (t.id === this.activeTabIdSignal() ? { ...t, query, modified: true } : t))
    );
    this.logger?.logUserAction("workbench", "updateQuery", { queryLength: query.length });
  }

  updateTab(tabId: string, updates: Partial<QueryTab>): void {
    const startTime = performance.now();
    this.tabsSignal.set(this.tabs().map((t) => (t.id === tabId ? { ...t, ...updates } : t)));
    this.logger?.logUserAction("workbench", "updateTab", {
      tabId,
      updateKeys: Object.keys(updates),
    });
  }

  updateActiveTab(updates: Partial<QueryTab>): void {
    const startTime = performance.now();
    this.tabsSignal.update((tabs) =>
      tabs.map((t) => (t.id === this.activeTabIdSignal() ? { ...t, ...updates } : t))
    );
    this.logger?.logUserAction("workbench", "updateActiveTab", {
      updateKeys: Object.keys(updates),
    });
  }

  updateAllTabs(updates: Partial<QueryTab>): void {
    const startTime = performance.now();
    this.tabsSignal.set(this.tabs().map((t) => ({ ...t, ...updates })));
    this.logger?.logUserAction("workbench", "updateAllTabs", {
      tabCount: this.tabs().length,
      updateKeys: Object.keys(updates),
    });
  }
}
