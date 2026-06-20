import { Injectable, inject, signal, computed } from "@angular/core";
import { PersistentStorageService } from "@shared/services/persistent-storage.service";
import { QueryTemplate, TemplateCategory, QueryTemplateFilter } from "../models";
import { FilterOperator } from "@entities/entities.connection.config";
import { findById } from "@shared/utils/array.utils";
const TEMPLATES_STORAGE_KEY = "zenith_query_templates";
const FAVORITES_STORAGE_KEY = "zenith_template_favorites";
@Injectable({ providedIn: "root" })
export class TemplateService {
  private readonly storage = inject(PersistentStorageService);
  private readonly templatesSignal = signal<QueryTemplate[]>([]);
  private readonly favoritesSignal = signal<Set<string>>(new Set());
  readonly templates = this.templatesSignal.asReadonly();
  readonly favorites = this.favoritesSignal.asReadonly();
  readonly templatesByCategory = computed(() => {
    const templates = this.templatesSignal();
    const categories: Record<TemplateCategory, QueryTemplate[]> = {
      search: [],
      modify: [],
      aggregate: [],
      admin: [],
    };
    for (const template of templates) {
      if (categories[template.category]) {
        categories[template.category].push(template);
      }
    }
    return categories;
  });
  readonly favoriteTemplates = computed(() => {
    const favs = this.favoritesSignal();
    return this.templatesSignal().filter((t) => favs.has(t.id));
  });
  constructor() {
    this.loadTemplates();
    this.loadFavorites();
  }
  private loadTemplates(): void {
    const stored = this.storage.get<QueryTemplate[]>(TEMPLATES_STORAGE_KEY);
    if (stored && stored.length > 0) {
      this.templatesSignal.set([...BUILT_IN_TEMPLATES, ...stored.filter((t) => !t.isBuiltIn)]);
    } else {
      this.templatesSignal.set(BUILT_IN_TEMPLATES);
    }
  }
  private loadFavorites(): void {
    const stored = this.storage.get<string[]>(FAVORITES_STORAGE_KEY);
    if (stored) {
      this.favoritesSignal.set(new Set(stored));
    }
  }
  private saveTemplates(): void {
    const userTemplates = this.templatesSignal().filter((t) => !t.isBuiltIn);
    this.storage.set(TEMPLATES_STORAGE_KEY, userTemplates);
  }
  private saveFavorites(): void {
    this.storage.set(FAVORITES_STORAGE_KEY, Array.from(this.favoritesSignal()));
  }
  getTemplateById(id: string): QueryTemplate | undefined {
    return findById(this.templatesSignal(), id);
  }
  getTemplatesByCategory(category: TemplateCategory): QueryTemplate[] {
    return this.templatesSignal().filter((t) => t.category === category);
  }
  getTemplatesByProvider(providerType: string): QueryTemplate[] {
    return this.templatesSignal().filter(
      (t) => t.providerTypes.includes(providerType as any) || t.providerTypes.length === 0
    );
  }
  searchTemplates(query: string): QueryTemplate[] {
    const lower = query.toLowerCase();
    return this.templatesSignal().filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.keywords?.some((k) => k.toLowerCase().includes(lower))
    );
  }
  addTemplate(template: Omit<QueryTemplate, "id" | "isBuiltIn">): QueryTemplate {
    const newTemplate: QueryTemplate = {
      ...template,
      id: crypto.randomUUID(),
      isBuiltIn: false,
    };
    this.templatesSignal.update((templates) => [...templates, newTemplate]);
    this.saveTemplates();
    return newTemplate;
  }
  updateTemplate(id: string, updates: Partial<QueryTemplate>): void {
    this.templatesSignal.update((templates) =>
      templates.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
    this.saveTemplates();
  }
  deleteTemplate(id: string): void {
    const template = this.getTemplateById(id);
    if (template?.isBuiltIn) return;
    this.templatesSignal.update((templates) => templates.filter((t) => t.id !== id));
    this.favoritesSignal.update((favs) => {
      const newFavs = new Set(favs);
      newFavs.delete(id);
      return newFavs;
    });
    this.saveTemplates();
    this.saveFavorites();
  }
  toggleFavorite(id: string): void {
    const isFav = this.favoritesSignal().has(id);
    this.favoritesSignal.update((favs) => {
      const newFavs = new Set(favs);
      if (newFavs.has(id)) {
        newFavs.delete(id);
      } else {
        newFavs.add(id);
      }
      return newFavs;
    });
    this.saveFavorites();
  }
  isFavorite(id: string): boolean {
    return this.favoritesSignal().has(id);
  }
  applyTemplate(
    template: QueryTemplate,
    variables: Record<string, unknown>
  ): {
    filter: QueryTemplateFilter;
    sort?: { field: string; direction: "asc" | "desc" }[];
    limit?: number;
  } {
    const filter = this.substituteVariables(template.filterTemplate, variables);
    return {
      filter,
      sort: template.variables.find((v) => v.name === "sort")?.defaultValue as any,
      limit: template.variables.find((v) => v.name === "limit")?.defaultValue as number,
    };
  }
  private substituteVariables(
    filter: QueryTemplateFilter,
    variables: Record<string, unknown>
  ): QueryTemplateFilter {
    return {
      ...filter,
      conditions: filter.conditions.map((c) => ({
        ...c,
        value: c.variable ? (variables[c.variable] ?? c.value) : c.value,
        field: c.field?.startsWith("{{") ? this.substituteVariable(c.field, variables) : c.field,
      })),
      groups: filter.groups?.map((g) => this.substituteVariables(g, variables)),
    };
  }
  private substituteVariable(str: string, variables: Record<string, unknown>): string {
    const match = str.match(/^\{\{(\w+)\}\}$/);
    if (match) {
      return String(variables[match[1]] ?? str);
    }
    return str;
  }
}
const BUILT_IN_TEMPLATES: QueryTemplate[] = [
  {
    id: "find-all",
    name: "Find All Records",
    description: "Retrieve all records from a collection",
    category: "search",
    providerTypes: [],
    filterTemplate: { operator: "and", conditions: [] },
    variables: [
      { name: "collection", label: "Collection", type: "string", required: true },
      { name: "limit", label: "Limit", type: "number", required: false, defaultValue: 100 },
    ],
    icon: "list",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["all", "find", "select", "list"],
  },
  {
    id: "find-by-id",
    name: "Find by ID",
    description: "Find a specific record by its ID",
    category: "search",
    providerTypes: [],
    filterTemplate: {
      operator: "and",
      conditions: [{ field: "_id", operator: "eq", variable: "id" }],
    },
    variables: [
      { name: "collection", label: "Collection", type: "string", required: true },
      { name: "id", label: "ID", type: "string", required: true },
    ],
    icon: "search",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["id", "find", "primary key", "lookup"],
  },
  {
    id: "search-field",
    name: "Search by Field",
    description: "Search for records where a field contains a value",
    category: "search",
    providerTypes: [],
    filterTemplate: {
      operator: "and",
      conditions: [{ field: "{{field}}", operator: "contains", variable: "searchText" }],
    },
    variables: [
      { name: "collection", label: "Collection", type: "string", required: true },
      { name: "field", label: "Field", type: "string", required: true },
      {
        name: "searchText",
        label: "Search Text",
        type: "string",
        required: true,
        placeholder: "Enter search term...",
      },
    ],
    icon: "search",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["search", "contains", "find", "filter"],
  },
  {
    id: "filter-sort",
    name: "Filter and Sort",
    description: "Filter records and sort by a field",
    category: "search",
    providerTypes: [],
    filterTemplate: {
      operator: "and",
      conditions: [],
    },
    variables: [
      { name: "collection", label: "Collection", type: "string", required: true },
      { name: "sortField", label: "Sort Field", type: "string", required: true },
      {
        name: "sortDirection",
        label: "Sort Direction",
        type: "select",
        options: ["asc", "desc"],
        required: true,
        defaultValue: "asc",
      },
    ],
    icon: "sort",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["filter", "sort", "order", "arrange"],
  },
  {
    id: "paginate",
    name: "Paginate Results",
    description: "Get a specific page of records",
    category: "search",
    providerTypes: [],
    filterTemplate: {
      operator: "and",
      conditions: [],
    },
    variables: [
      { name: "collection", label: "Collection", type: "string", required: true },
      { name: "page", label: "Page Number", type: "number", required: true, defaultValue: 1 },
      { name: "pageSize", label: "Page Size", type: "number", required: true, defaultValue: 25 },
    ],
    icon: "pagination",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["page", "paginate", "limit", "skip"],
  },
  {
    id: "find-nulls",
    name: "Find Null Values",
    description: "Find records where a field is null",
    category: "search",
    providerTypes: [],
    filterTemplate: {
      operator: "and",
      conditions: [{ field: "{{field}}", operator: "isNull" }],
    },
    variables: [
      { name: "collection", label: "Collection", type: "string", required: true },
      { name: "field", label: "Field", type: "string", required: true },
    ],
    icon: "null",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["null", "empty", "missing", "undefined"],
  },
  {
    id: "find-duplicates",
    name: "Find Duplicates",
    description: "Find records with duplicate values in a field",
    category: "search",
    providerTypes: ["mongodb"],
    filterTemplate: {
      operator: "and",
      conditions: [],
    },
    variables: [
      { name: "collection", label: "Collection", type: "string", required: true },
      { name: "field", label: "Field", type: "string", required: true },
    ],
    icon: "duplicate",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["duplicate", "repeated", "same", "group"],
  },
  {
    id: "count-records",
    name: "Count Records",
    description: "Count total number of records",
    category: "aggregate",
    providerTypes: [],
    filterTemplate: {
      operator: "and",
      conditions: [],
    },
    variables: [{ name: "collection", label: "Collection", type: "string", required: true }],
    icon: "count",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["count", "total", "number", "aggregate"],
  },
  {
    id: "sum-field",
    name: "Sum Field",
    description: "Calculate sum of a numeric field",
    category: "aggregate",
    providerTypes: ["mongodb", "sql"],
    filterTemplate: {
      operator: "and",
      conditions: [],
    },
    variables: [
      { name: "collection", label: "Collection", type: "string", required: true },
      { name: "field", label: "Field", type: "string", required: true },
    ],
    icon: "sum",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["sum", "total", "aggregate", "math"],
  },
  {
    id: "avg-field",
    name: "Average Field",
    description: "Calculate average of a numeric field",
    category: "aggregate",
    providerTypes: ["mongodb", "sql"],
    filterTemplate: {
      operator: "and",
      conditions: [],
    },
    variables: [
      { name: "collection", label: "Collection", type: "string", required: true },
      { name: "field", label: "Field", type: "string", required: true },
    ],
    icon: "avg",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["average", "mean", "aggregate", "math"],
  },
  {
    id: "group-by",
    name: "Group by Field",
    description: "Group records and count them",
    category: "aggregate",
    providerTypes: ["mongodb"],
    filterTemplate: {
      operator: "and",
      conditions: [],
    },
    variables: [
      { name: "collection", label: "Collection", type: "string", required: true },
      { name: "groupField", label: "Group By Field", type: "string", required: true },
    ],
    icon: "group",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["group", "aggregate", "categorize", "bucket"],
  },
  {
    id: "update-multi",
    name: "Update Multiple Records",
    description: "Update all records matching a filter",
    category: "modify",
    providerTypes: [],
    filterTemplate: {
      operator: "and",
      conditions: [],
    },
    variables: [
      { name: "collection", label: "Collection", type: "string", required: true },
      { name: "updateField", label: "Update Field", type: "string", required: true },
      { name: "newValue", label: "New Value", type: "string", required: true },
    ],
    icon: "edit",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["update", "edit", "modify", "batch"],
  },
  {
    id: "delete-old",
    name: "Delete Old Records",
    description: "Delete records older than a date",
    category: "modify",
    providerTypes: [],
    filterTemplate: {
      operator: "and",
      conditions: [{ field: "{{dateField}}", operator: "lt", variable: "cutoffDate" }],
    },
    variables: [
      { name: "collection", label: "Collection", type: "string", required: true },
      { name: "dateField", label: "Date Field", type: "string", required: true },
      { name: "cutoffDate", label: "Cutoff Date", type: "string", required: true },
    ],
    icon: "delete",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["delete", "remove", "cleanup", "old"],
  },
  {
    id: "list-indexes",
    name: "List Indexes",
    description: "Show all indexes on a collection",
    category: "admin",
    providerTypes: ["mongodb", "sql"],
    filterTemplate: { operator: "and", conditions: [] },
    variables: [{ name: "collection", label: "Collection", type: "string", required: true }],
    icon: "index",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["index", "list", "schema", "admin"],
  },
  {
    id: "fulltext-search",
    name: "Full-Text Search",
    description: "Search using text index",
    category: "search",
    providerTypes: ["mongodb", "sql"],
    filterTemplate: {
      operator: "and",
      conditions: [{ field: "$text", operator: "eq", variable: "searchQuery" }],
    },
    variables: [
      { name: "collection", label: "Collection", type: "string", required: true },
      {
        name: "searchQuery",
        label: "Search Query",
        type: "string",
        required: true,
        placeholder: "Enter search words...",
      },
    ],
    icon: "text",
    isFavorite: false,
    isBuiltIn: true,
    keywords: ["text", "search", "full", "index"],
  },
];
