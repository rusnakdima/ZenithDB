import { Injectable, inject, signal } from "@angular/core";
import { DataStoreService } from "@shared/services/core/unified-storage.service";
import { ToastService } from "@services/toast.service";
import { SchemaCompletionService } from "@features/query/services";
import { FieldInfo } from "@features/query/models";
import { RowData } from "@shared/models/connection.config";
import { getRecordId } from "@shared/utils/record.utils";
import { logger } from "../../../services/logger.service";

export interface BulkUpdateRequest {
  collectionName: string;
  documentIds: string[];
  field: string;
  value: unknown;
}

export interface BulkDeleteRequest {
  collectionName: string;
  documentIds: string[];
  softDelete?: boolean;
}

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: string[];
}

@Injectable({ providedIn: "root" })
export class BulkOperationsService {
  private readonly dataStore = inject(DataStoreService);
  private readonly toast = inject(ToastService);
  private readonly schemaCompletion = inject(SchemaCompletionService);

  private readonly operationInProgress = signal(false);

  get isOperating(): boolean {
    return this.operationInProgress();
  }

  async getFields(collectionName: string): Promise<FieldInfo[]> {
    return this.schemaCompletion.getFields(collectionName);
  }

  async executeBulkUpdate(request: BulkUpdateRequest): Promise<BulkOperationResult> {
    this.operationInProgress.set(true);
    const result: BulkOperationResult = { success: 0, failed: 0, errors: [] };

    try {
      logger.info(
        "[DATA_BULK]",
        `Bulk update started: ${request.documentIds.length} records, field=${request.field}`
      );
      for (const id of request.documentIds) {
        try {
          const document = await this.fetchDocument(request.collectionName, id);
          if (document) {
            document[request.field] = request.value;
            await this.dataStore.saveRow(request.collectionName, document);
            result.success++;
          } else {
            result.failed++;
            result.errors.push(`Document ${id} not found`);
          }
        } catch (e) {
          result.failed++;
          result.errors.push(`Failed to update ${id}: ${(e as Error).message}`);
        }
      }

      if (result.failed > 0) {
        this.toast.warning(`Updated ${result.success} records, ${result.failed} failed`);
      } else {
        this.toast.success(`Successfully updated ${result.success} records`);
      }

      this.dataStore.invalidateCollectionCache(request.collectionName);
    } finally {
      this.operationInProgress.set(false);
    }

    return result;
  }

  async executeBulkDelete(request: BulkDeleteRequest): Promise<BulkOperationResult> {
    this.operationInProgress.set(true);
    const result: BulkOperationResult = { success: 0, failed: 0, errors: [] };

    try {
      logger.info(
        "[DATA_BULK]",
        `Bulk delete started: ${request.documentIds.length} records, softDelete=${request.softDelete}`
      );
      for (const id of request.documentIds) {
        try {
          await this.dataStore.deleteRow(request.collectionName, id);
          result.success++;
        } catch (e) {
          result.failed++;
          result.errors.push(`Failed to delete ${id}: ${(e as Error).message}`);
        }
      }

      if (result.failed > 0) {
        this.toast.warning(`Deleted ${result.success} records, ${result.failed} failed`);
      } else {
        this.toast.success(`Successfully deleted ${result.success} records`);
      }

      this.dataStore.invalidateCollectionCache(request.collectionName);
    } finally {
      this.operationInProgress.set(false);
    }

    return result;
  }

  async executeBulkUpdateFields(
    collectionName: string,
    updates: Array<{ id: string; field: string; value: unknown }>
  ): Promise<BulkOperationResult> {
    this.operationInProgress.set(true);
    const result: BulkOperationResult = { success: 0, failed: 0, errors: [] };

    try {
      logger.info("[DATA_BULK]", `Bulk update fields started: ${updates.length} updates`);
      for (const update of updates) {
        try {
          const document = await this.fetchDocument(collectionName, update.id);
          if (document) {
            document[update.field] = update.value;
            await this.dataStore.saveRow(collectionName, document);
            result.success++;
          } else {
            result.failed++;
            result.errors.push(`Document ${update.id} not found`);
          }
        } catch (e) {
          result.failed++;
          result.errors.push(`Failed to update ${update.id}: ${(e as Error).message}`);
        }
      }

      if (result.failed > 0) {
        this.toast.warning(`Updated ${result.success} records, ${result.failed} failed`);
      } else {
        this.toast.success(`Successfully updated ${result.success} records`);
      }

      this.dataStore.invalidateCollectionCache(collectionName);
    } finally {
      this.operationInProgress.set(false);
    }

    return result;
  }

  private async fetchDocument(collectionName: string, id: string): Promise<RowData | null> {
    const result = await this.dataStore.queryData(
      collectionName,
      {
        filter: { field: "_id", operator: "eq" as const, value: id },
        limit: 1,
      },
      true
    );

    return result.data.length > 0 ? result.data[0] : null;
  }

  getIdField(document: RowData): string | null {
    return getRecordId(document);
  }
}
