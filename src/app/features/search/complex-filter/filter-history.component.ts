import { Component, Input, Output, EventEmitter, inject, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { PersistentStorageService } from "@shared/services/persistent-storage.service";
import { FilterExpression } from "@entities/entities.connection.config";
import { NamedFilter } from "./complex-filter.component";
@Component({
  selector: "app-filter-history",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./filter-history.component.html",
})
export class FilterHistoryComponent implements OnInit {
  private readonly storage = inject(PersistentStorageService);

  @Input() namedFilters: NamedFilter[] = [];
  @Output() historySelect = new EventEmitter<FilterExpression>();
  @Output() historyDelete = new EventEmitter<FilterExpression>();
  @Output() namedFilterApply = new EventEmitter<NamedFilter>();
  @Output() namedFilterDelete = new EventEmitter<string>();

  historyItems = signal<FilterExpression[]>([]);

  ngOnInit(): void {
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
    this.historySelect.emit(item);
  }

  onHistoryItemDelete(item: FilterExpression, event: MouseEvent): void {
    event.stopPropagation();
    this.historyDelete.emit(item);
    this.loadHistory();
  }

  onNamedFilterApply(namedFilter: NamedFilter): void {
    this.namedFilterApply.emit(namedFilter);
  }

  onNamedFilterDelete(id: string, event: MouseEvent): void {
    event.stopPropagation();
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
    const serialized = JSON.stringify(filter);
    return serialized || String(index);
  }
}
