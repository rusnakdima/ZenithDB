import { Injectable, inject, signal } from "@angular/core";
import { ConnectionStateService } from "@services/services.connection-state.service";
import { LoadingService } from "@shared/services/loading.service";
import { ToastService } from "@services/services.toast.service";
import { ApiProvider } from "@providers/providers.api.provider";
import { IndexInfo } from "@entities/entities.connection.config";
import { withConnectionAndLoading } from "@shared/utils/api-wrapper.util";

export interface IndexDefinition {
  name: string;
  type: "single" | "compound" | "text" | "geospatial" | "ttl" | "hashed";
  fields: IndexField[];
  options: IndexOptions;
}

export interface IndexField {
  name: string;
  direction: "asc" | "desc";
  weight?: number;
}

export interface IndexOptions {
  unique?: boolean;
  sparse?: boolean;
  ttlSeconds?: number;
  defaultLanguage?: string;
  [key: string]: unknown;
}

export interface IndexRecommendation {
  field: string;
  reason: string;
  estimatedImpact: "high" | "medium" | "low";
  suggestedIndex: Partial<IndexDefinition>;
}

@Injectable({ providedIn: "root" })
export class IndexService {
  private connectionState = inject(ConnectionStateService);
  private loadingService = inject(LoadingService);
  private toast = inject(ToastService);
  private api = inject(ApiProvider);

  private indexesCache = signal<Map<string, IndexInfo[]>>(new Map());

  async getIndexes(collectionName: string): Promise<IndexInfo[]> {
    const cached = this.indexesCache().get(collectionName);
    if (cached) return cached;

    const connId = this.connectionState.activeConnectionId();
    if (!connId) return [];

    try {
      const schema = await this.api.describeCollection(connId, collectionName);
      const indexes = schema.indexes || [];
      this.indexesCache.update((cache) => {
        const newCache = new Map(cache);
        newCache.set(collectionName, indexes);
        return newCache;
      });
      return indexes;
    } catch (e) {
      this.toast.error("Failed to load indexes: " + (e as Error).message);
      return [];
    }
  }

  async createIndex(collectionName: string, indexDef: IndexDefinition): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) throw new Error("No active connection");

    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Creating index ${indexDef.name}...`,
      async (connId) => {
        await this.api.createIndex(connId, collectionName, indexDef);
        this.invalidateCache(collectionName);
      }
    );
  }

  async dropIndex(collectionName: string, indexName: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) throw new Error("No active connection");

    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Dropping index ${indexName}...`,
      async (connId) => {
        await this.api.dropIndex(connId, collectionName, indexName);
        this.invalidateCache(collectionName);
      }
    );
  }

  async rebuildIndex(collectionName: string, indexName: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) throw new Error("No active connection");

    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Rebuilding index ${indexName}...`,
      async (connId) => {
        await this.api.rebuildIndex(connId, collectionName, indexName);
      }
    );
  }

  invalidateCache(collectionName?: string): void {
    this.indexesCache.update((cache) => {
      const newCache = new Map(cache);
      if (collectionName) {
        newCache.delete(collectionName);
      } else {
        newCache.clear();
      }
      return newCache;
    });
  }

  generateIndexName(collectionName: string, fields: string[]): string {
    return `${collectionName}_${fields.join("_")}_idx`;
  }

  analyzeQueryForIndexes(queryFilter: unknown): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    if (!queryFilter || typeof queryFilter !== "object") {
      return recommendations;
    }

    const filter = queryFilter as Record<string, unknown>;

    if (filter["and"] && Array.isArray(filter["and"])) {
      for (const subFilter of filter["and"] as Record<string, unknown>[]) {
        this.analyzeSingleFilter(subFilter, recommendations);
      }
    } else if (filter["or"] && Array.isArray(filter["or"])) {
      for (const subFilter of filter["or"] as Record<string, unknown>[]) {
        this.analyzeSingleFilter(subFilter, recommendations);
      }
    } else {
      this.analyzeSingleFilter(filter, recommendations);
    }

    return recommendations;
  }

  private analyzeSingleFilter(
    filter: Record<string, unknown>,
    recommendations: IndexRecommendation[]
  ): void {
    if (filter["field"] && filter["operator"]) {
      const field = filter["field"] as string;
      const operator = filter["operator"] as string;

      if (!field.startsWith("_") && operator !== "eq" && operator !== "neq") {
        recommendations.push({
          field,
          reason: `Query uses ${operator} operator on "${field}"`,
          estimatedImpact: "medium",
          suggestedIndex: {
            type: "single",
            fields: [{ name: field, direction: "asc" }],
          },
        });
      }
    }
  }
}
