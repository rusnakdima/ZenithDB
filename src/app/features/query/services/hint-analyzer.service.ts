import { Injectable, inject } from "@angular/core";
import { FilterExpression } from "@shared/models/connection.config";
import { SchemaCompletionService } from "./schema-completion.service";
import { ProviderDetectorService } from "./provider-detector.service";
import { logger } from "../../../services/logger.service";

export interface QueryHint {
  type: "info" | "warning" | "error";
  message: string;
  code?: string;
  action?: {
    label: string;
    execute: () => void;
  };
}

export interface IndexRecommendation {
  field: string;
  reason: string;
  impact: "high" | "medium" | "low";
  suggestedIndex?: string;
}

@Injectable({ providedIn: "root" })
export class HintAnalyzerService {
  private readonly schemaCompletion = inject(SchemaCompletionService);
  private readonly providerDetector = inject(ProviderDetectorService);

  async analyzeQuery(filter: FilterExpression, collectionName: string): Promise<QueryHint[]> {
    const hints: QueryHint[] = [];

    if (!filter) return hints;

    const fields = await this.schemaCompletion.getFields(collectionName);
    const fieldsSet = new Set(fields.map((f) => f.name));

    if (filter.field && !fieldsSet.has(filter.field)) {
      hints.push({
        type: "warning",
        message: `Field "${filter.field}" may not exist in collection "${collectionName}"`,
        code: "UNKNOWN_FIELD",
      });
    }

    const usedFields = this.extractFields(filter);
    for (const field of usedFields) {
      if (!fieldsSet.has(field)) {
        hints.push({
          type: "warning",
          message: `Field "${field}" not found in schema`,
          code: "FIELD_NOT_FOUND",
        });
      }
    }

    if (filter.and && filter.and.length > 3) {
      hints.push({
        type: "info",
        message: "Consider creating a compound index for frequently combined filters",
        code: "COMPOUND_INDEX_SUGGESTION",
        action: {
          label: "Create Index",
          execute: () => this.createCompoundIndexSuggestion(collectionName, usedFields),
        },
      });
    }

    if (this.hasFullTableScan(filter)) {
      hints.push({
        type: "warning",
        message: "This query may require a full collection scan",
        code: "FULL_SCAN",
        action: {
          label: "Add Index",
          execute: () => this.createIndexSuggestion(collectionName, usedFields[0]),
        },
      });
    }

    if (this.hasLeadingWildcard(filter)) {
      hints.push({
        type: "warning",
        message: "LIKE pattern with leading wildcard cannot use index",
        code: "LEADING_WILDCARD",
      });
    }

    return hints;
  }

  async getIndexRecommendations(
    collectionName: string,
    filter: FilterExpression
  ): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];
    const fields = await this.schemaCompletion.getFields(collectionName);
    const usedFields = this.extractFields(filter);

    if (usedFields.length === 0) return recommendations;

    const missingIndexes = usedFields.filter((f) => !this.hasIndex(fields, f));
    if (missingIndexes.length > 0) {
      recommendations.push({
        field: missingIndexes[0],
        reason: `Field "${missingIndexes[0]}" is used in filter but has no index`,
        impact: "high",
        suggestedIndex: this.buildIndexName(missingIndexes[0]),
      });
    }

    return recommendations;
  }

  private extractFields(filter: FilterExpression): string[] {
    const fields: string[] = [];

    if (filter.field) {
      fields.push(filter.field);
    }

    if (filter.and) {
      for (const subFilter of filter.and) {
        fields.push(...this.extractFields(subFilter));
      }
    }

    if (filter.or) {
      for (const subFilter of filter.or) {
        fields.push(...this.extractFields(subFilter));
      }
    }

    if (filter.not) {
      fields.push(...this.extractFields(filter.not));
    }

    return [...new Set(fields)];
  }

  private hasFullTableScan(filter: FilterExpression): boolean {
    return !filter.field && !filter.and && !filter.or && !filter.not;
  }

  private hasLeadingWildcard(filter: FilterExpression): boolean {
    if (filter.operator === "like" && typeof filter.value === "string") {
      return filter.value.startsWith("%");
    }

    if (filter.and) {
      return filter.and.some((f) => this.hasLeadingWildcard(f));
    }

    if (filter.or) {
      return filter.or.some((f) => this.hasLeadingWildcard(f));
    }

    if (filter.not) {
      return this.hasLeadingWildcard(filter.not);
    }

    return false;
  }

  private hasIndex(fields: { name: string }[], fieldName: string): boolean {
    return fields.some((f) => f.name === fieldName);
  }

  private buildIndexName(field: string): string {
    return `idx_${field.toLowerCase()}`;
  }

  private createCompoundIndexSuggestion(collectionName: string, fields: string[]): void {
    logger.info("[HINT_ANALYZER]", "Creating compound index", {
      collectionName,
      fields: fields.join(", "),
    });
  }

  private createIndexSuggestion(collectionName: string, field: string): void {
    logger.info("[HINT_ANALYZER]", "Creating index", { collectionName, field });
  }

  analyzeSort(sortField: string, collectionName: string): QueryHint[] {
    const hints: QueryHint[] = [];

    if (sortField && !sortField.startsWith("_")) {
      hints.push({
        type: "info",
        message: `Sorting by "${sortField}" - ensure an index exists for optimal performance`,
        code: "SORT_INDEX",
      });
    }

    return hints;
  }

  analyzeProjection(fields: string[], collectionName: string): QueryHint[] {
    const hints: QueryHint[] = [];

    if (fields.length === 0) {
      hints.push({
        type: "info",
        message: "Consider selecting specific fields instead of all (*) for better performance",
        code: "PROJECTION_HINT",
      });
    }

    return hints;
  }
}
