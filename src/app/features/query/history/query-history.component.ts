import { Component, Output, EventEmitter, signal, computed, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { QueryHistoryService, QueryHistoryEntry } from "./query-history.service";
import { TIME_CONSTANTS } from "@shared/utils/constants";

type FilterTab = "all" | "successful" | "failed";

@Component({
  selector: "app-query-history",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./query-history.component.html",
})
export class QueryHistoryComponent implements OnInit {
  private readonly historyService = inject(QueryHistoryService);

  @Output() loadQuery = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  activeTab = signal<FilterTab>("all");
  searchFilter = signal("");

  readonly history = this.historyService.history;
  readonly totalQueries = this.historyService.totalQueries;
  readonly averageExecutionTime = this.historyService.averageExecutionTime;
  readonly mostFrequentQueries = this.historyService.mostFrequentQueries;
  readonly slowestQueries = this.historyService.slowestQueries;
  readonly successfulQueries = this.historyService.successfulQueries;

  readonly filteredHistory = computed(() => {
    const tab = this.activeTab();
    const search = this.searchFilter().toLowerCase();
    let entries = this.historyService.getFilteredHistory(tab);

    if (search) {
      entries = entries.filter((h) => h.query.toLowerCase().includes(search));
    }

    return entries;
  });

  ngOnInit(): void {}

  setTab(tab: FilterTab): void {
    this.activeTab.set(tab);
  }

  onSearchInput(value: string): void {
    this.searchFilter.set(value);
  }

  clearSearch(): void {
    this.searchFilter.set("");
  }

  loadQueryText(query: string): void {
    this.loadQuery.emit(query);
    this.close.emit();
  }

  removeEntry(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.historyService.removeQuery(id);
  }

  clearHistory(event: MouseEvent): void {
    event.stopPropagation();
    this.historyService.clearHistory();
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / TIME_CONSTANTS.ONE_MINUTE_MS);
    const diffHours = Math.floor(diffMs / TIME_CONSTANTS.ONE_HOUR_MS);
    const diffDays = Math.floor(diffMs / TIME_CONSTANTS.TWENTY_FOUR_HOURS_MS);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  formatDuration(duration: number): string {
    if (duration < 1000) return `${duration}ms`;
    if (duration < TIME_CONSTANTS.ONE_MINUTE_MS) return `${(duration / 1000).toFixed(1)}s`;
    return `${Math.floor(duration / TIME_CONSTANTS.ONE_MINUTE_MS)}m ${Math.floor((duration % TIME_CONSTANTS.ONE_MINUTE_MS) / 1000)}s`;
  }

  getQueryPreview(query: string): string {
    const trimmed = query.trim();
    if (trimmed.length <= 60) return trimmed;
    return trimmed.substring(0, 60) + "...";
  }

  trackByEntry(index: number, entry: QueryHistoryEntry): string {
    return entry.id;
  }
}
