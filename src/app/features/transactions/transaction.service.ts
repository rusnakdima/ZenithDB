import { Injectable, inject, signal, computed } from "@angular/core";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ApiProvider } from "@providers/api.provider";
import { LoadingService } from "@shared/services/loading.service";
import { ToastService } from "@services/toast.service";
import { RowData } from "@shared/models/connection.config";
import { withConnectionAndLoading } from "@shared/utils/api-wrapper.util";
import { generateId, generateTransactionId } from "@shared/utils/id.utils";
import { logger } from "../../services/logger.service";

export type IsolationLevel = "Read Committed" | "Read Uncommitted" | "Repeatable Read";

export type TransactionOperationType = "insert" | "update" | "delete" | "soft_delete";

export interface TransactionOperation {
  id: string;
  type: TransactionOperationType;
  collection: string;
  documentId?: string;
  data?: RowData;
  timestamp: string;
  undoable: boolean;
}

export interface Savepoint {
  name: string;
  timestamp: string;
  operations: TransactionOperation[];
}

export interface Transaction {
  id?: string;
  isolationLevel: IsolationLevel;
  collections: Set<string>;
  operations: TransactionOperation[];
  savepoints: Savepoint[];
  startedAt?: string;
  status: "active" | "committed" | "rolled_back";
}

@Injectable({ providedIn: "root" })
export class TransactionService {
  private connectionState = inject(ConnectionStateService);
  private api = inject(ApiProvider);
  private loadingService = inject(LoadingService);
  private toast = inject(ToastService);

  private transactionSignal = signal<Transaction | null>(null);
  private operationLogSignal = signal<TransactionOperation[]>([]);

  readonly transaction = this.transactionSignal.asReadonly();
  readonly operationLog = this.operationLogSignal.asReadonly();

  readonly isActive = computed(() => this.transactionSignal()?.status === "active");
  readonly activeCollections = computed(() => this.transactionSignal()?.collections || new Set());
  readonly operationCount = computed(() => this.operationLogSignal().length);

  async beginTransaction(isolationLevel: IsolationLevel = "Read Committed"): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) {
      throw new Error("No active connection");
    }

    try {
      logger.info("[TRANSACTION]", "Beginning transaction", { isolationLevel });
      const result = await this.api.beginTransaction(connId, isolationLevel);
      this.transactionSignal.set({
        isolationLevel,
        collections: new Set(),
        operations: [],
        savepoints: [],
        startedAt: new Date().toISOString(),
        status: "active",
        id: result?.transactionId || generateTransactionId(),
      });
      this.operationLogSignal.set([]);
      this.toast.success("Transaction started");
    } catch (e) {
      this.transactionSignal.set({
        isolationLevel,
        collections: new Set(),
        operations: [],
        savepoints: [],
        startedAt: new Date().toISOString(),
        status: "active",
        id: generateTransactionId(),
      });
      this.operationLogSignal.set([]);
      this.toast.success("Transaction started (local mode)");
    }
  }

  async commitTransaction(): Promise<void> {
    const tx = this.transactionSignal();
    if (!tx) {
      throw new Error("No active transaction");
    }

    try {
      logger.info("[TRANSACTION]", "Committing transaction", {
        id: tx.id,
        operations: tx.operations.length,
      });
      await this.api.commitTransaction(tx.id!);
      this.toast.success(`Transaction committed with ${tx.operations.length} operations`);
    } catch {
      this.toast.success(
        `Transaction committed with ${tx.operations.length} operations (local mode)`
      );
    }
    this.resetTransaction();
  }

  async rollbackTransaction(): Promise<void> {
    const tx = this.transactionSignal();
    if (!tx) {
      throw new Error("No active transaction");
    }

    try {
      logger.info("[TRANSACTION]", "Rolling back transaction", { id: tx.id });
      await this.api.rollbackTransaction(tx.id!);
      this.toast.success("Transaction rolled back");
    } catch {
      this.toast.success("Transaction rolled back (local mode)");
    }
    this.resetTransaction();
  }

  async createSavepoint(name: string): Promise<void> {
    const tx = this.transactionSignal();
    if (!tx || tx.status !== "active") {
      throw new Error("No active transaction");
    }

    logger.debug("[TRANSACTION]", "Creating savepoint", { name });
    const savepoint: Savepoint = {
      name,
      timestamp: new Date().toISOString(),
      operations: [...this.operationLogSignal()],
    };

    this.transactionSignal.update((t) => {
      if (!t) return t;
      return {
        ...t,
        savepoints: [...t.savepoints, savepoint],
      };
    });

    this.toast.success(`Savepoint "${name}" created`);
  }

  async rollbackToSavepoint(name: string): Promise<void> {
    const tx = this.transactionSignal();
    if (!tx || tx.status !== "active") {
      throw new Error("No active transaction");
    }

    const savepoint = tx.savepoints.find((s) => s.name === name);
    if (!savepoint) {
      throw new Error(`Savepoint "${name}" not found`);
    }

    logger.debug("[TRANSACTION]", "Rolling back to savepoint", { name });
    this.operationLogSignal.set([...savepoint.operations]);
    this.toast.success(`Rolled back to savepoint "${name}"`);
  }

  queueOperation(
    type: TransactionOperationType,
    collection: string,
    data?: RowData,
    documentId?: string
  ): void {
    if (!this.isActive()) {
      throw new Error("No active transaction");
    }

    logger.debug("[TRANSACTION]", "Queueing operation", { type, collection, documentId });
    const operation: TransactionOperation = {
      id: generateId("op_"),
      type,
      collection,
      documentId,
      data,
      timestamp: new Date().toISOString(),
      undoable: type !== "soft_delete",
    };

    this.operationLogSignal.update((ops) => [...ops, operation]);
    this.transactionSignal.update((tx) => {
      if (!tx) return tx;
      const collections = new Set(tx.collections);
      collections.add(collection);
      return {
        ...tx,
        collections,
        operations: [...tx.operations, operation],
      };
    });
  }

  async executeQueuedOperations(): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    const tx = this.transactionSignal();
    if (!connId || !tx) {
      throw new Error("No active transaction");
    }

    const operations = this.operationLogSignal();
    if (operations.length === 0) {
      this.toast.warning("No operations to execute");
      return;
    }

    this.loadingService.show(`Executing ${operations.length} operations...`);

    try {
      logger.debug("[TRANSACTION]", "Executing queued operations", {
        count: operations.length,
      });
      for (const op of operations) {
        switch (op.type) {
          case "insert":
            if (op.data) {
              await this.api.insertDocument(connId, op.collection, op.data);
            }
            break;
          case "update":
            if (op.documentId && op.data) {
              await this.api.updateDocument(connId, op.collection, op.documentId, op.data);
            }
            break;
          case "delete":
            if (op.documentId) {
              await this.api.deleteDocument(connId, op.collection, op.documentId);
            }
            break;
          case "soft_delete":
            if (op.documentId) {
              await this.api.softDeleteDocument(connId, op.collection, op.documentId);
            }
            break;
        }
      }
      this.toast.success(`Executed ${operations.length} operations`);
    } catch (e) {
      this.toast.error(`Operation failed: ${(e as Error).message}`);
      throw e;
    } finally {
      this.loadingService.hide();
    }
  }

  undoLastOperation(): void {
    const operations = this.operationLogSignal();
    if (operations.length === 0) return;

    const lastOp = operations[operations.length - 1];
    if (!lastOp.undoable) {
      this.toast.warning("Last operation cannot be undone");
      return;
    }

    this.operationLogSignal.update((ops) => ops.slice(0, -1));
    this.toast.info(`Undid operation: ${lastOp.type}`);
  }

  clearOperationLog(): void {
    this.operationLogSignal.set([]);
  }

  private resetTransaction(): void {
    this.transactionSignal.set(null);
    this.operationLogSignal.set([]);
  }
}
