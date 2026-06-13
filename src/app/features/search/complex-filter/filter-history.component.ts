import { Component, Input, Output, EventEmitter, inject, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { PersistentStorageService } from "@shared/services/persistent-storage.service";
import { FilterExpression } from "@shared/models/connection.config";
import { NamedFilter } from "./complex-filter.component";
import { LoggingService } from "@shared/services/logging.service";

@Component({
  selector: "app-filter-history",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./filter-history.component.html",
})
export class FilterHistoryComponent implements OnInit {
  private readonly storage = inject(PersistentStorageService);
  private logger = inject(LoggingService);

  @Input() namedFilters: NamedFilter[] = [];
  @Output() historySelect = new EventEmitter<FilterExpression>();
  @Output() historyDelete = new EventEmitter<FilterExpression>();
  @Output() namedFilterApply = new EventEmitter<NamedFilter>();
  @Output() namedFilterDelete = new EventEmitter<string>();

  historyItems = signal<FilterExpression[]>([]);

  ngOnInit(): void {
    this.logger.debug("[SEARCH_FILTER]", "Filter history component initialized");
    this.loadHistory();
  }

  private loadHistory(): void {
    const history = this.storage.getFilterHistory();
    const items: FilterExpression[] = [];
    for (const jsonStr of history) {
      try {
        items.push(JSON.parse(jsonStr));
      } catch {}
    }
    this.historyItems.set(items);
  }

  onHistoryItemSelect(item: FilterExpression): void {
    this.logger.debug("[SEARCH_FILTER]", "Filter history item selected", { item });
    this.historySelect.emit(item);
  }

  onHistoryItemDelete(item: FilterExpression, event: MouseEvent): void {
    event.stopPropagation();
    this.logger.debug("[SEARCH_FILTER]", "Filter history item deleted", { item });
    this.historyDelete.emit(item);
    this.loadHistory();
  }

  onNamedFilterApply(namedFilter: NamedFilter): void {
    this.logger.info("[SEARCH_FILTER]", "Named filter applied", { name: namedFilter.name });
    this.namedFilterApply.emit(namedFilter);
  }

  onNamedFilterDelete(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.logger.debug("[SEARCH_FILTER]", "Named filter deleted", { id });
    this.namedFilterDelete.emit(id);
  }

  formatFilterPreview(filter: FilterExpression): string {
    const parts: string[] = [];

    if (filter.and) {
      parts.push(`AND (${filter.and.length} conditions)`);
    }
    if (filter.or) {
      parts.push(`OR (${filter.or.length} conditions)`);
    }
    if (filter.field) {
      parts.push(`${filter.field} ${filter.operator || "eq"} ${filter.value ?? "null"}`);
    }

    return parts.slice(0, 3).join(", ") || "Empty filter";
  }

  trackByFilter(index: number, filter: FilterExpression): string {
    return JSON.stringify(filter);
  }
}
