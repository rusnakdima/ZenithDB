import { Injectable, inject, signal } from "@angular/core";
import { FieldInfo, FieldType } from "../models";
import { SchemaService } from "@shared/services/schema.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { LoggingService } from "@shared/services/logging.service";

export interface CompletionItem {
  label: string;
  kind: "collection" | "field" | "operator" | "keyword" | "value";
  detail?: string;
  documentation?: string;
  insertText: string;
  filterText?: string;
  sortText?: string;
}

export interface CompletionContext {
  position: number;
  text: string;
  triggerKind: "invoked" | "triggerCharacter" | "triggerForIncompleteCompletions";
  triggerCharacter?: string;
}

@Injectable({ providedIn: "root" })
export class SchemaCompletionService {
  private readonly schemaService = inject(SchemaService);
  private readonly connectionState = inject(ConnectionStateService);
  private readonly logger = inject(LoggingService);

  private readonly schemaCacheSignal = signal<Map<string, FieldInfo[]>>(new Map());

  async getCollections(): Promise<string[]> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) return [];

    try {
      const collections = await this.schemaService.listCollections(connId);
      return collections.map((c) => c.name);
    } catch {
      return [];
    }
  }

  async getFields(collectionName: string): Promise<FieldInfo[]> {
    const cached = this.schemaCacheSignal().get(collectionName);
    if (cached) return cached;

    const connId = this.connectionState.activeConnectionId();
    if (!connId) return [];

    try {
      this.logger.debug("[QUERY]", "Fetching fields for collection", { collectionName });
      const schema = await this.schemaService.describeCollection(collectionName);
      const fields = schema.columns.map((col) => ({
        name: col.name,
        type: this.mapColumnType(col.data_type),
        nullable: col.nullable,
        isPrimaryKey: col.is_primary_key,
      }));

      this.schemaCacheSignal.update((cache) => {
        const newCache = new Map(cache);
        newCache.set(collectionName, fields);
        return newCache;
      });

      this.logger.debug("[QUERY]", "Cached fields for collection", {
        collectionName,
        fieldCount: fields.length,
      });
      return fields;
    } catch {
      return [];
    }
  }

  async getCompletionItems(collectionName?: string): Promise<CompletionItem[]> {
    const items: CompletionItem[] = [];

    const collections = await this.getCollections();
    for (const collection of collections) {
      items.push({
        label: collection,
        kind: "collection",
        detail: "Collection",
        insertText: collection,
        filterText: collection,
        sortText: "1",
      });
    }

    if (collectionName) {
      const fields = await this.getFields(collectionName);
      for (const field of fields) {
        items.push({
          label: field.name,
          kind: "field",
          detail: `Field (${field.type})`,
          documentation: `${field.type}${field.nullable ? ", nullable" : ""}${field.isPrimaryKey ? ", primary key" : ""}`,
          insertText: field.name,
          filterText: field.name,
          sortText: `2-${field.name}`,
        });
      }
    }

    return items;
  }

  invalidateCache(collectionName?: string): void {
    if (collectionName) {
      this.logger.debug("[QUERY]", "Invalidating schema cache for collection", { collectionName });
      this.schemaCacheSignal.update((cache) => {
        const newCache = new Map(cache);
        newCache.delete(collectionName);
        return newCache;
      });
    } else {
      this.logger.debug("[QUERY]", "Invalidating all schema cache");
      this.schemaCacheSignal.set(new Map());
    }
  }

  private mapColumnType(type: string): FieldType {
    const lower = type.toLowerCase();
    if (
      lower.includes("int") ||
      lower.includes("float") ||
      lower.includes("double") ||
      lower.includes("decimal")
    ) {
      return "number";
    }
    if (lower.includes("bool")) {
      return "boolean";
    }
    if (lower.includes("date") || lower.includes("time")) {
      return "date";
    }
    if (lower.includes("array")) {
      return "array";
    }
    if (lower.includes("object") || lower.includes("json")) {
      return "object";
    }
    return "string";
  }
}
