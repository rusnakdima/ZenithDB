import { Injectable, signal, computed, inject } from "@angular/core";
import { QueryTab } from "@entities/entities.query.entity";
import { findById } from "@shared/utils/array.utils";
@Injectable({ providedIn: "root" })
export class TabService {
  private readonly tabsSignal = signal<QueryTab[]>([this.createTab("Tab 1")]);
  private readonly activeTabIdSignal = signal<string>("Tab 1");

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
  }

  selectTab(tabId: string): void {
    const startTime = performance.now();
    this.activeTabIdSignal.set(tabId);
  }

  updateQuery(query: string): void {
    const startTime = performance.now();
    this.tabsSignal.update((tabs) =>
      tabs.map((t) => (t.id === this.activeTabIdSignal() ? { ...t, query, modified: true } : t))
    );
  }

  updateTab(tabId: string, updates: Partial<QueryTab>): void {
    const startTime = performance.now();
    this.tabsSignal.set(this.tabs().map((t) => (t.id === tabId ? { ...t, ...updates } : t)));
  }

  updateActiveTab(updates: Partial<QueryTab>): void {
    const startTime = performance.now();
    this.tabsSignal.update((tabs) =>
      tabs.map((t) => (t.id === this.activeTabIdSignal() ? { ...t, ...updates } : t))
    );
  }

  updateAllTabs(updates: Partial<QueryTab>): void {
    const startTime = performance.now();
    this.tabsSignal.set(this.tabs().map((t) => ({ ...t, ...updates })));
  }
}
