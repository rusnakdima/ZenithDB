import { Injectable, inject, signal } from "@angular/core";
import { SchemaService } from "@shared/services/schema.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ApiProvider } from "@providers/api.provider";
import { CollectionMeta, FilterExpression, RowData } from "@shared/models/connection.config";

export interface QuickSearchResult {
  collection: string;
  document: RowData;
  matchedFields: string[];
  score: number;
}

export interface GroupedSearchResults {
  collection: string;
  count: number;
  results: QuickSearchResult[];
}

@Injectable({ providedIn: "root" })
export class QuickSearchService {
  private readonly schemaService = inject(SchemaService);
  private readonly connectionState = inject(ConnectionStateService);
  private readonly api = inject(ApiProvider);

  private readonly searchResultsSignal = signal<GroupedSearchResults[]>([]);
  private readonly isSearchingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly searchResults = this.searchResultsSignal.asReadonly();
  readonly isSearching = this.isSearchingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  private debounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 200;
  private readonly MAX_RESULTS_PER_COLLECTION = 10;

  async search(query: string): Promise<void> {
    if (this.debounceTimeoutId) {
      clearTimeout(this.debounceTimeoutId);
    }

    if (!query.trim()) {
      this.searchResultsSignal.set([]);
      this.isSearchingSignal.set(false);
      return;
    }

    this.isSearchingSignal.set(true);
    this.errorSignal.set(null);

    this.debounceTimeoutId = setTimeout(async () => {
      try {
        const results = await this.performSearch(query);
        this.searchResultsSignal.set(results);
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : "Search failed";
        this.errorSignal.set(error);
        this.searchResultsSignal.set([]);
      } finally {
        this.isSearchingSignal.set(false);
      }
    }, this.DEBOUNCE_MS);
  }

  private async performSearch(query: string): Promise<GroupedSearchResults[]> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) return [];

    const collections = await this.schemaService.listCollections(connId);
    const searchPromises = collections.map((collection) =>
      this.searchCollection(collection.name, query, connId)
    );

    const results = await Promise.allSettled(searchPromises);
    const groupedResults: GroupedSearchResults[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const collection = collections[i];

      if (result.status === "fulfilled" && result.value.length > 0) {
        groupedResults.push({
          collection: collection.name,
          count: result.value.length,
          results: result.value,
        });
      }
    }

    return groupedResults.sort((a, b) => b.count - a.count);
  }

  private async searchCollection(
    collectionName: string,
    query: string,
    connId: string
  ): Promise<QuickSearchResult[]> {
    try {
      const schema = await this.schemaService.describeCollection(collectionName);
      const searchableFields = schema.columns
        .filter((col) => ["string", "text", "varchar"].includes(col.data_type.toLowerCase()))
        .map((col) => col.name);

      if (searchableFields.length === 0) return [];

      const filter = this.buildSearchFilter(searchableFields, query);
      const result = await this.api.queryData(connId, collectionName, {
        filter,
        limit: this.MAX_RESULTS_PER_COLLECTION,
      });

      const queryLower = query.toLowerCase();
      const scored = result.data
        .map((doc) => this.scoreDocument(doc, searchableFields, queryLower))
        .filter((r): r is QuickSearchResult => r !== null && r.score > 0);
      return scored;
    } catch {
      return [];
    }
  }

  private buildSearchFilter(fields: string[], query: string): FilterExpression {
    return {
      or: fields.map((field) => ({
        field,
        operator: "contains" as const,
        value: query,
      })),
    };
  }

  private scoreDocument(
    document: RowData,
    searchableFields: string[],
    queryLower: string
  ): QuickSearchResult | null {
    const matchedFields: string[] = [];
    let totalMatches = 0;

    for (const field of searchableFields) {
      const value = document[field];
      if (value !== undefined && value !== null) {
        const valueStr = String(value).toLowerCase();
        if (valueStr.includes(queryLower)) {
          matchedFields.push(field);
          const matches = (valueStr.match(new RegExp(this.escapeRegex(queryLower), "g")) || [])
            .length;
          totalMatches += matches;
        }
      }
    }

    if (matchedFields.length === 0) return null;

    return {
      collection: "",
      document,
      matchedFields,
      score: totalMatches,
    };
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  clearResults(): void {
    this.searchResultsSignal.set([]);
    this.errorSignal.set(null);
  }

  cancelSearch(): void {
    if (this.debounceTimeoutId) {
      clearTimeout(this.debounceTimeoutId);
      this.debounceTimeoutId = null;
    }
    this.isSearchingSignal.set(false);
  }
}
