import {
  Component,
  Input,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { SchemaCompletionService } from "../../query/services/schema-completion.service";
import { ProviderDetectorService } from "../../query/services/provider-detector.service";
import { FieldInfo } from "../../query/models";
import { TextIndexDialogComponent } from "./text-index-dialog.component";
import { DialogService } from "@shared/services/dialog.service";
import { TIME_CONSTANTS } from "@shared/utils/constants";
export interface SearchResult {
  document: Record<string, unknown>;
  score: number;
  highlights: Record<string, string[]>;
}
export interface FieldWeight {
  field: string;
  weight: number;
}
export type SortOrder = "relevance" | "date";
@Component({
  selector: "app-fulltext-search",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: "./fulltext-search.component.html",
})
export class FulltextSearchComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private readonly schemaCompletionService = inject(SchemaCompletionService);
  private readonly providerDetectorService = inject(ProviderDetectorService);
  private readonly dialogService = inject(DialogService);
  @Input() collectionName: string = "";
  searchQuery = signal("");
  fieldWeights = signal<FieldWeight[]>([]);
  results = signal<SearchResult[]>([]);
  isSearching = signal(false);
  showFieldWeights = signal(false);
  sortOrder = signal<SortOrder>("relevance");
  error = signal<string | null>(null);
  fields = signal<FieldInfo[]>([]);
  availableFields = signal<FieldInfo[]>([]);
  syntaxMode = this.providerDetectorService.currentSyntaxMode;
  supportsFullTextSearch = this.providerDetectorService.supportsFullTextSearch;
  hasTextIndex = signal(false);
  textIndexDefinition = signal<FieldWeight[]>([]);
  activeFieldWeightsCount = computed(() => {
    return this.fieldWeights().filter((w) => w.weight > 0).length;
  });
  private debounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 300;
  ngOnInit(): void {
    this.loadFields();
  }
  ngOnDestroy(): void {
    if (this.debounceTimeoutId) {
      clearTimeout(this.debounceTimeoutId);
    }
  }
  async loadFields(): Promise<void> {
    if (!this.collectionName) return;
    try {
      const fields = await this.schemaCompletionService.getFields(this.collectionName);
      this.fields.set(fields);
      this.availableFields.set(fields.filter((f) => f.type === "string"));
      const weights: FieldWeight[] = fields
        .filter((f) => f.type === "string")
        .map((f) => ({ field: f.name, weight: 1 }));
      this.fieldWeights.set(weights);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : "Failed to load fields";
      this.error.set(error);
    }
  }
  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    if (this.debounceTimeoutId) {
      clearTimeout(this.debounceTimeoutId);
    }
    if (!value.trim()) {
      this.results.set([]);
      this.isSearching.set(false);
      return;
    }
    this.isSearching.set(true);
    this.debounceTimeoutId = setTimeout(() => {
      this.executeSearch();
    }, this.DEBOUNCE_MS);
  }
  async executeSearch(): Promise<void> {
    const query = this.searchQuery();
    if (!query.trim() || !this.collectionName) {
      this.results.set([]);
      this.isSearching.set(false);
      return;
    }
    this.isSearching.set(true);
    this.error.set(null);
    try {
      const weightedFields = this.fieldWeights();
      const searchResults = await this.performSearch(query, weightedFields);
      this.results.set(searchResults);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : "Search failed";
      this.error.set(error);
      this.results.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }
  private async performSearch(query: string, weights: FieldWeight[]): Promise<SearchResult[]> {
    return this.simulateSearchResults(query, weights);
  }
  private simulateSearchResults(query: string, weights: FieldWeight[]): SearchResult[] {
    const queryLower = query.toLowerCase();
    const sampleDocs: Record<string, unknown>[] = [
      {
        id: 1,
        name: "Sample document for testing",
        content: "This is a test document with the search term",
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        name: "Another example",
        content: "More content containing " + query,
        createdAt: new Date(Date.now() - TIME_CONSTANTS.TWENTY_FOUR_HOURS_MS).toISOString(),
      },
      {
        id: 3,
        name: "Third result",
        content: "Additional information here",
        createdAt: new Date(Date.now() - TIME_CONSTANTS.TWENTY_FOUR_HOURS_MS * 2).toISOString(),
      },
    ];
    return sampleDocs
      .map((doc) => {
        const highlights: Record<string, string[]> = {};
        const docString = JSON.stringify(doc).toLowerCase();
        const matches = queryLower.split(" ").filter((term) => docString.includes(term));
        if (matches.length === 0) return null;
        for (const field of Object.keys(doc)) {
          const value = String(doc[field]).toLowerCase();
          const fieldHighlights = matches.filter((term) => value.includes(term));
          if (fieldHighlights.length > 0) {
            highlights[field] = fieldHighlights;
          }
        }
        return {
          document: doc,
          score: matches.length * 0.5 + Math.random() * 0.5,
          highlights,
        };
      })
      .filter((r): r is SearchResult => r !== null)
      .sort((a, b) => {
        if (this.sortOrder() === "relevance") {
          return b.score - a.score;
        }
        const dateA = a.document["createdAt"];
        const dateB = b.document["createdAt"];
        return new Date(dateB as string).getTime() - new Date(dateA as string).getTime();
      });
  }
  updateFieldWeight(field: string, weight: number): void {
    this.fieldWeights.update((weights) => {
      const existing = weights.find((w) => w.field === field);
      if (existing) {
        return weights.map((w) => (w.field === field ? { ...w, weight } : w));
      }
      return [...weights, { field, weight }];
    });
  }
  toggleFieldWeights(): void {
    this.showFieldWeights.update((v) => !v);
  }
  openTextIndexDialog(): void {
    this.dialogService.open({
      component: TextIndexDialogComponent,
      inputs: {
        collectionName: this.collectionName,
        fields: this.availableFields(),
        existingWeights: this.fieldWeights(),
      },
      width: "500px",
      closable: true,
    });
  }
  onTextIndexCreated(weights: FieldWeight[]): void {
    this.fieldWeights.set(weights);
    this.hasTextIndex.set(true);
    this.textIndexDefinition.set(weights);
  }
  getHighlightedText(text: string, highlights: string[]): string {
    if (!highlights || highlights.length === 0) return text;
    let result = text;
    for (const highlight of highlights) {
      const regex = new RegExp(`(${highlight})`, "gi");
      result = result.replace(
        regex,
        '<mark class="bg-yellow-500/30 text-yellow-200 rounded px-0.5">$1</mark>'
      );
    }
    return result;
  }
  clearSearch(): void {
    this.searchQuery.set("");
    this.results.set([]);
    this.error.set(null);
  }
  setSortOrder(order: SortOrder): void {
    this.sortOrder.set(order);
    if (this.results().length > 0) {
      this.executeSearch();
    }
  }
  getDocumentId(doc: Record<string, unknown>): string {
    return String(doc["id"] ?? "unknown");
  }
  getDocumentField(doc: Record<string, unknown>, fieldName: string): unknown {
    return doc[fieldName];
  }
  getDocumentCreatedAt(doc: Record<string, unknown>): string | null {
    const createdAt = doc["createdAt"];
    if (!createdAt) return null;
    return String(createdAt);
  }
  toStringValue(value: unknown): string {
    return String(value);
  }
}
