import { Injectable, inject } from "@angular/core";
import { DataStoreService } from "@core/services/unified-storage.service";
import { ToastService } from "@services/services.toast.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { ExportService } from "@services/services.export.service";
import { PersistentStorageService } from "@shared/services/persistent-storage.service";
import { DataTableGridStore } from "../store/data-table-grid.store";
import {
  RowData,
  ColumnInfo,
  FilterExpression,
  QueryParams,
  QueryResult,
} from "@entities/entities.connection.config";
import { safeJsonParse } from "@shared/utils/json.utils";
import { getRecordId } from "@shared/utils/record.utils";
import { ExportFormat } from "@app/features/data/export-dialog/export-dialog.component";
@Injectable({ providedIn: "root" })
export class DataTableGridService {
  private api = inject(DataStoreService);
  private store = inject(DataTableGridStore);
  private toast = inject(ToastService);
  private errorHandler = inject(ErrorHandlerService);
  private exportService = inject(ExportService);
  private persistentStorage = inject(PersistentStorageService);
  async loadData(collection: string, params: QueryParams, forceRefresh = false): Promise<void> {
    this.store.setLoading(true);
    this.store.clearError();
    const t0 = Date.now();
    try {
      const result = await this.api.queryData(collection, params, forceRefresh);
      this.store.setData(result.data as RowData[], result.total);
    } catch (error) {
      const message = (error as Error).message || "Failed to load data";
      this.store.setError(message);
      this.errorHandler.handleError(error, "DataTableGridService.loadData");
      throw error;
    } finally {
      this.store.setLoading(false);
    }
  }
  async loadColumnsFallback(collection: string): Promise<ColumnInfo[]> {
    try {
      const schema = await this.api.describeCollection(collection);
      return schema.columns;
    } catch (error) {
      this.errorHandler.handleError(error, "DataTableGridService.loadColumnsFallback");
      throw error;
    }
  }
  async deleteRecord(collection: string, record: RowData): Promise<void> {
    const id = getRecordId(record);
    if (!id) {
      this.toast.error("Cannot delete: record has no ID");
      return;
    }
    try {
      await this.api.deleteRow(collection, String(id));
      this.toast.success("Record deleted");
    } catch (error) {
      this.toast.error("Failed to delete record: " + (error as Error).message);
      this.errorHandler.handleError(error, "DataTableGridService.deleteRecord");
      throw error;
    }
  }
  async saveRecord(collection: string, record: RowData): Promise<void> {
    try {
      await this.api.saveRow(collection, record);
      this.toast.success("Record saved");
    } catch (error) {
      this.toast.error("Failed to save record: " + (error as Error).message);
      this.errorHandler.handleError(error, "DataTableGridService.saveRecord");
      throw error;
    }
  }
  async bulkDelete(collection: string): Promise<{ deleted: number; failed: number }> {
    const selectedData = this.store.getSelectedData();
    let deleted = 0;
    let failed = 0;
    for (const record of selectedData) {
      const id = getRecordId(record);
      if (id) {
        try {
          await this.api.deleteRow(collection, String(id));
          deleted++;
        } catch {
          failed++;
        }
      }
    }
    if (failed > 0) {
      this.toast.warning(`Deleted ${deleted} records, ${failed} failed`);
    } else {
      this.toast.success(`Deleted ${deleted} records`);
    }
    return { deleted, failed };
  }
  async exportData(collection: string, format: ExportFormat, filename?: string): Promise<void> {
    const dataToExport =
      this.store.selectedRows().size > 0 ? this.store.getSelectedData() : this.store.data();
    const exportFilename = filename || `${collection}_export_${Date.now()}`;
    try {
      await this.exportService.export({ format, filename: exportFilename }, dataToExport);
    } catch (error) {
      if ((error as Error).message !== "Export cancelled") {
        this.toast.error("Export failed");
        this.errorHandler.handleError(error, "DataTableGridService.exportData");
      }
      throw error;
    }
  }
  loadColumnOrder(collection: string, columns: ColumnInfo[]): string[] {
    const stored = this.persistentStorage.getColumnOrder(collection);
    if (stored && stored.length > 0) {
      const valid = stored.filter((c) => columns.some((col) => col.name === c));
      if (valid.length > 0) return valid;
    }
    return [];
  }
  saveColumnOrder(collection: string, order: string[]): void {
    this.persistentStorage.setColumnOrder(collection, order);
  }
  parseFilter(filter: string): FilterExpression | undefined {
    if (!filter) return undefined;
    const parsed = safeJsonParse<FilterExpression | undefined>(filter, undefined);
    if (parsed === undefined) {
      this.store.setError("Invalid filter JSON");
    }
    return parsed;
  }
  getIdField(columns: ColumnInfo[]): string | null {
    const pkCol = columns.find((c) => c.is_primary_key);
    return pkCol ? pkCol.name : null;
  }
}
