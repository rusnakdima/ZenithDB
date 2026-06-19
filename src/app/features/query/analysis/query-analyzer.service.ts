import { Injectable, inject } from "@angular/core";
import {
  HintAnalyzerService,
  QueryHint,
  IndexRecommendation,
} from "../services/hint-analyzer.service";
import { IndexService } from "@features/indexes/index.service";
import { FilterExpression } from "@app/models/connection.config";
import { SchemaCompletionService } from "../services/schema-completion.service";
import { IndexInfo } from "@app/models/connection.config";

export interface ExecutionPlanNode {
  id: string;
  operation: string;
  cost: number;
  rowsAffected: number;
  indexUsed?: string;
  isFullScan: boolean;
  children: ExecutionPlanNode[];
  description: string;
}

export interface QueryAnalysisResult {
  plan: ExecutionPlanNode[];
  hints: QueryHint[];
  recommendations: IndexRecommendation[];
  score: number;
}

@Injectable({ providedIn: "root" })
export class QueryAnalyzerService {
  private readonly hintAnalyzer = inject(HintAnalyzerService);
  private readonly indexService = inject(IndexService);
  private readonly schemaCompletion = inject(SchemaCompletionService);

  async analyzeQueryForPlan(
    filter: FilterExpression,
    collectionName: string
  ): Promise<ExecutionPlanNode[]> {
    const fields = await this.schemaCompletion.getFields(collectionName);
    const indexes = await this.indexService.getIndexes(collectionName);
    const plan = this.buildExecutionPlan(filter, collectionName, fields, indexes);
    return plan;
  }

  async analyzeQueryFull(
    filter: FilterExpression,
    collectionName: string
  ): Promise<QueryAnalysisResult> {
    const hints = await this.hintAnalyzer.analyzeQuery(filter, collectionName);
    const recommendations = await this.hintAnalyzer.getIndexRecommendations(collectionName, filter);
    const plan = await this.analyzeQueryForPlan(filter, collectionName);

    const score = this.calculateQueryScore(plan, hints);

    return { plan, hints, recommendations, score };
  }

  private buildExecutionPlan(
    filter: FilterExpression,
    collectionName: string,
    fields: { name: string; type: string }[],
    indexes: IndexInfo[]
  ): ExecutionPlanNode[] {
    const plan: ExecutionPlanNode[] = [];

    if (!filter || (!filter.field && !filter.and && !filter.or && !filter.not)) {
      plan.push(this.createCollectionScanNode(collectionName, "Full collection scan - no filter"));
      return plan;
    }

    const usedFields = this.extractFields(filter);

    for (const field of usedFields) {
      const matchingIndex = indexes.find((idx) => idx.columns && idx.columns.includes(field));

      if (matchingIndex) {
        plan.push(this.createIndexScanNode(field, matchingIndex.name, collectionName));
      } else if (this.hasLeadingWildcard(filter)) {
        plan.push(this.createIndexScanNode(field, undefined, collectionName, true));
      } else {
        plan.push(this.createFilterNode(field, collectionName));
      }
    }

    if (filter.and && filter.and.length > 1) {
      plan.push(this.createAndNode(filter.and.length, collectionName));
    }

    if (filter.or && filter.or.length > 1) {
      plan.push(this.createOrNode(filter.or.length, collectionName));
    }

    return plan;
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

  private createCollectionScanNode(collection: string, description: string): ExecutionPlanNode {
    return {
      id: crypto.randomUUID(),
      operation: "COLLECTION_SCAN",
      cost: 100,
      rowsAffected: -1,
      isFullScan: true,
      children: [],
      description,
    };
  }

  private createIndexScanNode(
    field: string,
    indexName: string | undefined,
    collection: string,
    isLeadingWildcard = false
  ): ExecutionPlanNode {
    return {
      id: crypto.randomUUID(),
      operation: "INDEX_SCAN",
      cost: 10,
      rowsAffected: -1,
      indexUsed: indexName,
      isFullScan: false,
      children: [],
      description: isLeadingWildcard
        ? `Index scan on ${field} (leading wildcard - full index scan)`
        : `Index scan on ${field} using ${indexName || "available index"}`,
    };
  }

  private createFilterNode(field: string, collection: string): ExecutionPlanNode {
    return {
      id: crypto.randomUUID(),
      operation: "FILTER",
      cost: 25,
      rowsAffected: -1,
      isFullScan: false,
      children: [],
      description: `Filter on ${field}`,
    };
  }

  private createAndNode(conditions: number, collection: string): ExecutionPlanNode {
    return {
      id: crypto.randomUUID(),
      operation: "AND",
      cost: 5,
      rowsAffected: -1,
      isFullScan: false,
      children: [],
      description: `Combine ${conditions} conditions with AND`,
    };
  }

  private createOrNode(conditions: number, collection: string): ExecutionPlanNode {
    return {
      id: crypto.randomUUID(),
      operation: "OR",
      cost: 15,
      rowsAffected: -1,
      isFullScan: false,
      children: [],
      description: `Combine ${conditions} conditions with OR`,
    };
  }

  private calculateQueryScore(plan: ExecutionPlanNode[], hints: QueryHint[]): number {
    let score = 100;

    for (const node of plan) {
      if (node.isFullScan) {
        score -= 30;
      }
      if (node.operation === "COLLECTION_SCAN") {
        score -= 40;
      }
    }

    const errorCount = hints.filter((h) => h.type === "error").length;
    const warningCount = hints.filter((h) => h.type === "warning").length;

    score -= errorCount * 20;
    score -= warningCount * 10;

    return Math.max(0, Math.min(100, score));
  }

  analyzeLikePattern(pattern: string): { isOptimized: boolean; suggestion: string } {
    if (!pattern) {
      return { isOptimized: true, suggestion: "" };
    }

    const hasLeadingWildcard = pattern.startsWith("%");
    const hasTrailingWildcard = pattern.endsWith("%");

    if (hasLeadingWildcard && hasTrailingWildcard) {
      return {
        isOptimized: false,
        suggestion: "Consider using a full-text index instead of LIKE with wildcards on both ends",
      };
    }

    if (hasLeadingWildcard) {
      return {
        isOptimized: false,
        suggestion: "Leading wildcards prevent index usage. Consider restructuring the query",
      };
    }

    return { isOptimized: true, suggestion: "" };
  }

  getExecutionPlanCost(plan: ExecutionPlanNode[]): number {
    return plan.reduce((total, node) => total + node.cost, 0);
  }

  async suggestOptimizations(
    collectionName: string,
    filter: FilterExpression
  ): Promise<{ field: string; reason: string; action: string }[]> {
    const suggestions: { field: string; reason: string; action: string }[] = [];
    const fields = await this.schemaCompletion.getFields(collectionName);
    const indexes = await this.indexService.getIndexes(collectionName);
    const usedFields = this.extractFields(filter);

    for (const field of usedFields) {
      const hasIndex = indexes.some((idx) => idx.columns && idx.columns.includes(field));
      const fieldInfo = fields.find((f) => f.name === field);

      if (!hasIndex) {
        suggestions.push({
          field,
          reason: `Field "${field}" is used in filter but has no index`,
          action: `Create index on ${field}`,
        });
      }

      if (fieldInfo?.type === "string" && !hasIndex) {
        suggestions.push({
          field,
          reason: `Consider a text index for string field "${field}" if used in full-text search`,
          action: `Create text index on ${field}`,
        });
      }
    }

    return suggestions;
  }
}
