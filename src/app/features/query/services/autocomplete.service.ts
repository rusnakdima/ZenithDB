import { Injectable, inject, signal, computed } from "@angular/core";
import {
  CompletionItem,
  CompletionContext,
  SchemaCompletionService,
} from "./schema-completion.service";
import { ProviderDetectorService } from "./provider-detector.service";
import { FilterOperator } from "@shared/models/connection.config";
import { FieldType, FIELD_OPERATORS } from "../models";
import { logger } from "../../../services/logger.service";

const KEYWORDS_SQL = [
  "SELECT",
  "FROM",
  "WHERE",
  "AND",
  "OR",
  "NOT",
  "ORDER BY",
  "GROUP BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "INNER JOIN",
  "INSERT INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE",
  "AS",
  "DISTINCT",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "LIKE",
  "IN",
  "BETWEEN",
  "IS NULL",
  "IS NOT NULL",
  "TRUE",
  "FALSE",
];

const KEYWORDS_MONGODB = [
  "db.collection.find",
  "db.collection.insertOne",
  "db.collection.updateOne",
  "db.collection.deleteOne",
  "db.collection.aggregate",
  "$match",
  "$group",
  "$sort",
  "$limit",
  "$skip",
  "$project",
  "$unwind",
  "$lookup",
  "$set",
  "$unset",
  "$inc",
  "$push",
  "$pull",
  "$addToSet",
];

const OPERATORS_BY_TYPE: Record<FieldType, { operator: FilterOperator; label: string }[]> = {
  string: [
    { operator: "eq", label: "equals" },
    { operator: "neq", label: "not equals" },
    { operator: "contains", label: "contains" },
    { operator: "startsWith", label: "starts with" },
    { operator: "endsWith", label: "ends with" },
    { operator: "like", label: "like" },
    { operator: "isNull", label: "is null" },
    { operator: "isNotNull", label: "is not null" },
    { operator: "in", label: "in" },
    { operator: "notIn", label: "not in" },
  ],
  number: [
    { operator: "eq", label: "equals" },
    { operator: "neq", label: "not equals" },
    { operator: "gt", label: "greater than" },
    { operator: "gte", label: "greater or equal" },
    { operator: "lt", label: "less than" },
    { operator: "lte", label: "less or equal" },
    { operator: "between", label: "between" },
    { operator: "isNull", label: "is null" },
    { operator: "isNotNull", label: "is not null" },
    { operator: "in", label: "in" },
    { operator: "notIn", label: "not in" },
  ],
  boolean: [
    { operator: "eq", label: "equals" },
    { operator: "neq", label: "not equals" },
    { operator: "isNull", label: "is null" },
    { operator: "isNotNull", label: "is not null" },
  ],
  date: [
    { operator: "eq", label: "equals" },
    { operator: "neq", label: "not equals" },
    { operator: "gt", label: "greater than" },
    { operator: "gte", label: "greater or equal" },
    { operator: "lt", label: "less than" },
    { operator: "lte", label: "less or equal" },
    { operator: "between", label: "between" },
    { operator: "isNull", label: "is null" },
    { operator: "isNotNull", label: "is not null" },
  ],
  array: [
    { operator: "isNull", label: "is null" },
    { operator: "isNotNull", label: "is not null" },
    { operator: "eq", label: "equals" },
    { operator: "neq", label: "not equals" },
  ],
  object: [
    { operator: "isNull", label: "is null" },
    { operator: "isNotNull", label: "is not null" },
    { operator: "eq", label: "equals" },
    { operator: "neq", label: "not equals" },
  ],
};

@Injectable({ providedIn: "root" })
export class AutocompleteService {
  private readonly schemaCompletion = inject(SchemaCompletionService);
  private readonly providerDetector = inject(ProviderDetectorService);
  

  private readonly isActiveSignal = signal(false);
  private readonly itemsSignal = signal<CompletionItem[]>([]);
  private readonly selectedIndexSignal = signal(0);

  readonly isActive = this.isActiveSignal.asReadonly();
  readonly items = this.itemsSignal.asReadonly();
  readonly selectedIndex = this.selectedIndexSignal.asReadonly();

  readonly selectedItem = computed(() => {
    const items = this.itemsSignal();
    const index = this.selectedIndexSignal();
    return items[index] ?? null;
  });

  async triggerCompletion(context: CompletionContext, collectionName?: string): Promise<void> {
    logger.debug("[QUERY_AUTOCOMPLETE]", "Triggering completion", {
      triggerKind: context.triggerKind,
      collectionName,
    });
    const items = await this.buildCompletionItems(context, collectionName);
    this.itemsSignal.set(items);
    this.isActiveSignal.set(items.length > 0);
    this.selectedIndexSignal.set(0);
    logger.debug("[QUERY_AUTOCOMPLETE]", "Completion items built", {
      itemCount: items.length,
    });
  }

  async triggerCompletionWithFields(
    context: CompletionContext,
    collectionName: string,
    currentField?: string
  ): Promise<void> {
    logger.debug("[QUERY_AUTOCOMPLETE]", "Triggering field completion", {
      collectionName,
      currentField,
    });
    const items = await this.buildFieldCompletionItems(collectionName, currentField);
    this.itemsSignal.set(items);
    this.isActiveSignal.set(items.length > 0);
    this.selectedIndexSignal.set(0);
  }

  private async buildCompletionItems(
    context: CompletionContext,
    collectionName?: string
  ): Promise<CompletionItem[]> {
    const text = context.text.substring(0, context.position);
    const lastWord = this.getLastWord(text);
    const prefix = lastWord.toLowerCase();

    if (!prefix) return [];

    const items: CompletionItem[] = [];

    const collections = await this.schemaCompletion.getCollections();
    for (const collection of collections) {
      if (collection.toLowerCase().includes(prefix)) {
        items.push({
          label: collection,
          kind: "collection",
          detail: "Collection",
          insertText: collection,
          filterText: collection,
          sortText: `1-${collection}`,
        });
      }
    }

    if (collectionName) {
      const fields = await this.schemaCompletion.getFields(collectionName);
      for (const field of fields) {
        if (field.name.toLowerCase().includes(prefix)) {
          items.push({
            label: field.name,
            kind: "field",
            detail: `Field (${field.type})`,
            documentation: `${field.type}${field.nullable ? ", nullable" : ""}`,
            insertText: field.name,
            filterText: field.name,
            sortText: `2-${field.name}`,
          });
        }
      }
    }

    const keywords =
      this.providerDetector.currentSyntaxMode() === "mongodb" ? KEYWORDS_MONGODB : KEYWORDS_SQL;

    for (const keyword of keywords) {
      if (keyword.toLowerCase().includes(prefix)) {
        items.push({
          label: keyword,
          kind: "keyword",
          detail: "Keyword",
          insertText: keyword,
          filterText: keyword,
          sortText: `3-${keyword}`,
        });
      }
    }

    return items.sort((a, b) => (a.sortText ?? "").localeCompare(b.sortText ?? ""));
  }

  private async buildFieldCompletionItems(
    collectionName: string,
    currentField?: string
  ): Promise<CompletionItem[]> {
    const fields = await this.schemaCompletion.getFields(collectionName);
    const items: CompletionItem[] = [];

    for (const field of fields) {
      items.push({
        label: field.name,
        kind: "field",
        detail: `Field (${field.type})`,
        documentation: `${field.type}${field.nullable ? ", nullable" : ""}`,
        insertText: field.name,
        filterText: field.name,
        sortText: field.name,
      });
    }

    const operators = currentField
      ? this.getOperatorsForField(fields.find((f) => f.name === currentField)?.type)
      : this.getAllOperators();

    for (const op of operators) {
      items.push({
        label: op.label,
        kind: "operator",
        detail: "Operator",
        insertText: op.operator,
        filterText: op.label,
        sortText: `z-${op.label}`,
      });
    }

    return items;
  }

  private getOperatorsForField(
    fieldType?: FieldType
  ): { operator: FilterOperator; label: string }[] {
    if (!fieldType) return this.getAllOperators();
    return (
      FIELD_OPERATORS[fieldType]?.map((op) => ({
        operator: op,
        label: this.getOperatorLabel(op),
      })) ?? this.getAllOperators()
    );
  }

  private getAllOperators(): { operator: FilterOperator; label: string }[] {
    const allOperators: { operator: FilterOperator; label: string }[] = [];
    for (const [, operators] of Object.entries(FIELD_OPERATORS)) {
      for (const op of operators) {
        if (!allOperators.find((o) => o.operator === op)) {
          allOperators.push({ operator: op, label: this.getOperatorLabel(op) });
        }
      }
    }
    return allOperators;
  }

  private getOperatorLabel(op: FilterOperator): string {
    const labels: Record<FilterOperator, string> = {
      eq: "equals (=)",
      neq: "not equals (!=)",
      gt: "greater than (>)",
      gte: "greater or equal (>=)",
      lt: "less than (<)",
      lte: "less or equal (<=)",
      contains: "contains",
      startsWith: "starts with",
      endsWith: "ends with",
      like: "like (%)",
      isNull: "is null",
      isNotNull: "is not null",
      in: "in (...)",
      notIn: "not in (...)",
      between: "between",
      and: "and",
      or: "or",
      not: "not",
    };
    return labels[op] ?? op;
  }

  private getLastWord(text: string): string {
    const match = text.match(/[\w\.]+$/);
    return match ? match[0] : "";
  }

  selectNext(): void {
    const items = this.itemsSignal();
    if (items.length === 0) return;

    this.selectedIndexSignal.update((i) => (i + 1) % items.length);
  }

  selectPrevious(): void {
    const items = this.itemsSignal();
    if (items.length === 0) return;

    this.selectedIndexSignal.update((i) => (i - 1 + items.length) % items.length);
  }

  confirmSelection(): CompletionItem | null {
    const item = this.selectedItem();
    if (item) {
      logger.debug("[QUERY_AUTOCOMPLETE]", "Item selected", {
        label: item.label,
        kind: item.kind,
      });
    }
    this.close();
    return item;
  }

  close(): void {
    this.isActiveSignal.set(false);
    this.itemsSignal.set([]);
    this.selectedIndexSignal.set(0);
  }

  updateItems(items: CompletionItem[]): void {
    this.itemsSignal.set(items);
    this.selectedIndexSignal.set(0);
  }
}
