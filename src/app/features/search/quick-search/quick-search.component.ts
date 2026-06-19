import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  HostListener,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  QuickSearchService,
  GroupedSearchResults,
  QuickSearchResult,
} from "./quick-search.service";
type SelectResult = {
  collection: string;
  document: Record<string, unknown>;
};

type FlatSearchResult = QuickSearchResult & {
  resultIndex: number;
};

@Component({
  selector: "app-quick-search",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./quick-search.component.html",
})
export class QuickSearchComponent implements OnInit, OnDestroy {
  private readonly searchService = inject(QuickSearchService);

  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() navigateToRecord = new EventEmitter<SelectResult>();

  searchQuery = signal("");
  selectedIndex = signal(-1);
  private refreshCallbacks: Set<() => void> = new Set();
  private boundGlobalFocusHandler: (() => void) | null = null;

  readonly isSearching = this.searchService.isSearching;
  readonly error = this.searchService.error;
  readonly groupedResults = this.searchService.searchResults;

  readonly flatResults = computed(() => {
    const groups = this.groupedResults();
    const flat: FlatSearchResult[] = [];
    let globalIndex = 0;

    for (const group of groups) {
      for (const result of group.results) {
        flat.push({
          ...result,
          collection: group.collection,
          resultIndex: globalIndex++,
        });
      }
    }
    return flat;
  });

  readonly totalResults = computed(() => this.flatResults().length);

  ngOnInit(): void {
    this.boundGlobalFocusHandler = this.handleGlobalFocus.bind(this);
    this.refreshCallbacks.add(this.handleKeyNavigation.bind(this));
    document.addEventListener("zenith:focus-search", this.boundGlobalFocusHandler);
  }

  ngOnDestroy(): void {
    if (this.boundGlobalFocusHandler) {
      document.removeEventListener("zenith:focus-search", this.boundGlobalFocusHandler);
    }
    this.searchService.cancelSearch();
  }

  private handleGlobalFocus(): void {
    if (!this.isOpen) {
      this.open();
    }
  }

  @HostListener("document:keydown", ["$event"])
  handleKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) return;

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        this.onClose();
        break;
      case "ArrowDown":
        event.preventDefault();
        this.moveSelection(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        this.moveSelection(-1);
        break;
      case "Enter":
        event.preventDefault();
        this.selectCurrentResult();
        break;
    }
  }

  open(): void {
    this.isOpen = true;
    this.searchQuery.set("");
    this.selectedIndex.set(-1);
    this.searchService.clearResults();
  }

  onClose(): void {
    this.isOpen = false;
    this.searchService.cancelSearch();
    this.close.emit();
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.selectedIndex.set(-1);
    if (value.trim()) {
      this.searchService.search(value);
    } else {
      this.searchService.clearResults();
    }
  }

  clearSearch(): void {
    this.searchQuery.set("");
    this.selectedIndex.set(-1);
    this.searchService.clearResults();
  }

  private moveSelection(delta: number): void {
    const total = this.totalResults();
    if (total === 0) return;

    const current = this.selectedIndex();
    let newIndex = current + delta;

    if (newIndex < 0) newIndex = total - 1;
    if (newIndex >= total) newIndex = 0;

    this.selectedIndex.set(newIndex);
  }

  private handleKeyNavigation(): void {
    // Reserved for future keyboard navigation callbacks
  }

  selectCurrentResult(): void {
    const index = this.selectedIndex();
    const flat = this.flatResults();
    if (index >= 0 && index < flat.length) {
      const item = flat[index];
      this.selectResult(item.collection, item.document);
    }
  }

  selectResult(collection: string, document: Record<string, unknown>): void {
    this.navigateToRecord.emit({ collection, document });
    this.onClose();
  }

  isSelected(globalIndex: number): boolean {
    return this.selectedIndex() === globalIndex;
  }

  getDocumentId(result: { document: Record<string, unknown> }): string {
    const doc = result.document;
    if (doc["id"] !== undefined) return String(doc["id"]);
    if (doc["_id"] !== undefined) return String(doc["_id"]);
    if (doc["name"] !== undefined) return String(doc["name"]);
    return "unknown";
  }

  getDocumentPreview(result: {
    document: Record<string, unknown>;
    matchedFields: string[];
  }): string {
    const doc = result.document;
    const fields = result.matchedFields;

    if (fields.length > 0) {
      const firstField = fields[0];
      const value = doc[firstField];
      return String(value ?? "").substring(0, 100);
    }

    const keys = Object.keys(doc).slice(0, 2);
    return keys.map((k) => `${k}: ${doc[k]}`).join(", ");
  }

  highlightMatch(text: string, query: string): string {
    if (!query.trim()) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return text.replace(
      regex,
      '<mark class="bg-emerald-500/30 text-emerald-300 rounded px-0.5">$1</mark>'
    );
  }
}
