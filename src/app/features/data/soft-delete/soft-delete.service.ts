import { Injectable, inject, signal } from "@angular/core";
import { DataStoreService } from "@services/core/data-store.service";
import { ToastService } from "@services/toast.service";
import { RowData } from "@shared/models/connection.config";
import { getRecordId } from "@shared/utils/record.utils";
import { AppLoggerService } from "@shared/services/app-logger.service";

export interface DeletedRecord extends RowData {
  _deletedAt: string;
  _originalValues?: RowData;
}

@Injectable({ providedIn: "root" })
export class SoftDeleteService {
  private dataStore = inject(DataStoreService);
  private toast = inject(ToastService);
  private logger = inject(AppLoggerService);

  private showDeletedSignal = signal(false);

  readonly showDeleted = this.showDeletedSignal.asReadonly();

  toggleShowDeleted(): void {
    this.showDeletedSignal.update((v) => !v);
  }

  setShowDeleted(show: boolean): void {
    this.showDeletedSignal.set(show);
  }

  async softDelete(collection: string, record: RowData): Promise<void> {
    const id = getRecordId(record);
    if (!id) {
      throw new Error("Record has no ID");
    }

    this.logger.info("[DATA]", `Soft deleting record ${id} from ${collection}`);
    const deletedRecord: RowData = {
      ...record,
      _deletedAt: new Date().toISOString(),
    };

    await this.dataStore.saveRow(collection, deletedRecord);
    this.toast.success("Record moved to trash");
  }

  async restore(collection: string, record: DeletedRecord): Promise<void> {
    const id = getRecordId(record);
    if (!id) {
      throw new Error("Record has no ID");
    }

    this.logger.info("[DATA]", `Restoring record ${id} to ${collection}`);
    const restoredRecord: RowData = { ...record };
    delete restoredRecord["_deletedAt"];
    delete restoredRecord["_originalValues"];

    await this.dataStore.saveRow(collection, restoredRecord);
    this.toast.success("Record restored");
  }

  async permanentDelete(collection: string, record: DeletedRecord): Promise<void> {
    const id = getRecordId(record);
    if (!id) {
      throw new Error("Record has no ID");
    }

    this.logger.info("[DATA]", `Permanently deleting record ${id} from ${collection}`);
    await this.dataStore.deleteRow(collection, String(id));
    this.toast.success("Record permanently deleted");
  }

  async bulkRestore(
    collection: string,
    records: DeletedRecord[]
  ): Promise<{ restored: number; failed: number }> {
    let restored = 0;
    let failed = 0;

    this.logger.info("[DATA]", `Bulk restoring ${records.length} records from ${collection}`);
    for (const record of records) {
      try {
        await this.restore(collection, record);
        restored++;
      } catch {
        failed++;
      }
    }

    return { restored, failed };
  }

  async bulkPermanentDelete(
    collection: string,
    records: DeletedRecord[]
  ): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;

    this.logger.info(
      "[DATA]",
      `Bulk permanently deleting ${records.length} records from ${collection}`
    );
    for (const record of records) {
      try {
        await this.permanentDelete(collection, record);
        deleted++;
      } catch {
        failed++;
      }
    }

    return { deleted, failed };
  }

  async getDeletedRecords(collection: string): Promise<DeletedRecord[]> {
    const result = await this.dataStore.queryData(collection, {
      filter: {
        field: "_deletedAt",
        operator: "isNotNull",
      },
      limit: 1000,
    });

    return result.data as DeletedRecord[];
  }

  isDeleted(record: RowData): record is DeletedRecord {
    return "_deletedAt" in record && record["_deletedAt"] != null;
  }

  getDeletedTimestamp(record: RowData): string | null {
    if ("_deletedAt" in record && record["_deletedAt"]) {
      return record["_deletedAt"] as string;
    }
    return null;
  }
}
