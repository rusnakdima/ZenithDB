import { Injectable, inject, signal, computed } from "@angular/core";
import { TransactionService, TransactionOperationType } from "../transaction.service";
import { ToastService } from "@services/toast.service";
import { RowData } from "@shared/models/connection.config";

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
    const operation: PendingOperation = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "insert",
      collection,
      data,
      timestamp: new Date().toISOString(),
    };
    this.queueSignal.update((q) => [...q, operation]);
  }

  queueUpdate(collection: string, documentId: string, data: RowData): void {
    const operation: PendingOperation = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "update",
      collection,
      documentId,
      data,
      timestamp: new Date().toISOString(),
    };
    this.queueSignal.update((q) => [...q, operation]);
  }

  queueDelete(collection: string, documentId: string): void {
    const operation: PendingOperation = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
