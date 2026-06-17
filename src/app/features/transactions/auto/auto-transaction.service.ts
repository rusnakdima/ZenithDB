import { Injectable, inject, signal, computed } from "@angular/core";
import { TransactionService, TransactionOperationType } from "../transaction.service";
import { ToastService } from "@services/toast.service";
import { RowData } from "@shared/models/connection.config";
import { generateBatchId } from "@shared/utils/id.utils";
import { logger } from "../../../services/logger.service";

export type PendingOperationType = "insert" | "update" | "delete";

export interface PendingOperation {
  id: string;
  type: PendingOperationType;
  collection: string;
  documentId?: string;
  data?: RowData;
  timestamp: string;
}

export interface BatchError {
  operation: PendingOperation;
  error: string;
}

@Injectable({ providedIn: "root" })
export class AutoTransactionService {
  private transactionService = inject(TransactionService);
  private toast = inject(ToastService);
  

  private queueSignal = signal<PendingOperation[]>([]);
  private errorSignal = signal<BatchError | null>(null);

  readonly queue = this.queueSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly queueCount = computed(() => this.queueSignal().length);
  readonly hasErrors = computed(() => this.errorSignal() !== null);

  readonly pendingByCollection = computed(() => {
    const queue = this.queueSignal();
    const byCollection = new Map<string, PendingOperation[]>();
    for (const op of queue) {
      const existing = byCollection.get(op.collection) || [];
      existing.push(op);
      byCollection.set(op.collection, existing);
    }
    return byCollection;
  });

  queueInsert(collection: string, data: RowData): void {
    logger.debug("[TRANSACTION]", "Queueing insert", { collection });
    const operation: PendingOperation = {
      id: generateBatchId(),
      type: "insert",
      collection,
      data,
      timestamp: new Date().toISOString(),
    };
    this.queueSignal.update((q) => [...q, operation]);
  }

  queueUpdate(collection: string, documentId: string, data: RowData): void {
    logger.debug("[TRANSACTION]", "Queueing update", { collection, documentId });
    const operation: PendingOperation = {
      id: generateBatchId(),
      type: "update",
      collection,
      documentId,
      data,
      timestamp: new Date().toISOString(),
    };
    this.queueSignal.update((q) => [...q, operation]);
  }

  queueDelete(collection: string, documentId: string): void {
    logger.debug("[TRANSACTION]", "Queueing delete", { collection, documentId });
    const operation: PendingOperation = {
      id: generateBatchId(),
      type: "delete",
      collection,
      documentId,
      timestamp: new Date().toISOString(),
    };
    this.queueSignal.update((q) => [...q, operation]);
  }

  removeFromQueue(operationId: string): void {
    this.queueSignal.update((q) => q.filter((op) => op.id !== operationId));
  }

  clearQueue(): void {
    this.queueSignal.set([]);
    this.errorSignal.set(null);
  }

  async commitAll(): Promise<boolean> {
    const queue = this.queueSignal();
    if (queue.length === 0) {
      this.toast.warning("No operations to commit");
      return false;
    }

    try {
      logger.info("[TRANSACTION]", "Starting batch commit", { count: queue.length });
      await this.transactionService.beginTransaction();

      for (const op of queue) {
        this.transactionService.queueOperation(
          op.type as TransactionOperationType,
          op.collection,
          op.data,
          op.documentId
        );
      }

      await this.transactionService.executeQueuedOperations();
      await this.transactionService.commitTransaction();

      this.toast.success(`Committed ${queue.length} operations`);
      this.queueSignal.set([]);
      return true;
    } catch (e) {
      const error = e as Error;
      logger.error("[TRANSACTION]", "Batch commit failed", { error: error.message });
      this.toast.error(`Batch failed: ${error.message}`);
      await this.rollbackOnError();
      return false;
    }
  }

  private async rollbackOnError(): Promise<void> {
    try {
      await this.transactionService.rollbackTransaction();
      this.toast.info("Batch rolled back due to error");
    } catch (e) {
      this.toast.error(`Rollback failed: ${(e as Error).message}`);
    }
  }

  getOperationClass(type: PendingOperationType): string {
    const classMap: Record<PendingOperationType, string> = {
      insert: "text-green-400",
      update: "text-blue-400",
      delete: "text-red-400",
    };
    return classMap[type] || "text-[var(--text-main)]";
  }

  getOperationIcon(type: PendingOperationType): string {
    const iconMap: Record<PendingOperationType, string> = {
      insert: "add",
      update: "edit",
      delete: "delete",
    };
    return iconMap[type] || "circle";
  }
}
