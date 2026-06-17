import { Component, inject, signal, computed, ChangeDetectionStrategy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { TransactionService, IsolationLevel } from "./transaction.service";
import { ToastService } from "@services/toast.service";
import { ConfirmService } from "@shared/services/confirm.service";
import { TransactionLogComponent } from "./transaction-log.component";
import { logger } from "../../services/logger.service";

@Component({
  selector: "app-transaction-panel",
  standalone: true,
  imports: [FormsModule, MatIconModule, TransactionLogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./transaction-panel.component.html",
})
export class TransactionPanelComponent {
  transactionService = inject(TransactionService);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);
  

  isActive = this.transactionService.isActive;
  activeCollections = this.transactionService.activeCollections;
  operationCount = this.transactionService.operationCount;
  operationLog = this.transactionService.operationLog;

  isolationLevel = signal<IsolationLevel>("Read Committed");
  showLog = signal(false);

  isolationLevels: IsolationLevel[] = ["Read Committed", "Read Uncommitted", "Repeatable Read"];

  collectionsList = computed(() => Array.from(this.activeCollections()));

  async onBeginTransaction(): Promise<void> {
    try {
      logger.info("[TRANSACTION]", "User initiating transaction", {
        isolationLevel: this.isolationLevel(),
      });
      await this.transactionService.beginTransaction(this.isolationLevel());
    } catch (e) {
      this.toast.error(`Failed to start transaction: ${(e as Error).message}`);
    }
  }

  async onCommit(): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: "Commit Transaction",
      message: `Are you sure you want to commit ${this.operationCount()} operations?`,
      confirmText: "Commit",
    });

    if (!confirmed) return;

    try {
      logger.info("[TRANSACTION]", "User committing transaction");
      await this.transactionService.commitTransaction();
    } catch (e) {
      this.toast.error(`Failed to commit: ${(e as Error).message}`);
    }
  }

  async onRollback(): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: "Rollback Transaction",
      message: "Are you sure you want to rollback all changes?",
      confirmText: "Rollback",
    });

    if (!confirmed) return;

    try {
      logger.info("[TRANSACTION]", "User rolling back transaction");
      await this.transactionService.rollbackTransaction();
    } catch (e) {
      this.toast.error(`Failed to rollback: ${(e as Error).message}`);
    }
  }

  async onCreateSavepoint(): Promise<void> {
    const name = prompt("Enter savepoint name:");
    if (!name) return;

    try {
      logger.debug("[TRANSACTION]", "User creating savepoint", { name });
      await this.transactionService.createSavepoint(name);
    } catch (e) {
      this.toast.error(`Failed to create savepoint: ${(e as Error).message}`);
    }
  }

  async onRollbackToSavepoint(): Promise<void> {
    const tx = this.transactionService.transaction();
    if (!tx || tx.savepoints.length === 0) {
      this.toast.warning("No savepoints available");
      return;
    }

    const name = prompt(
      `Available savepoints: ${tx.savepoints.map((s) => s.name).join(", ")}\nEnter savepoint name to rollback to:`
    );
    if (!name) return;

    try {
      logger.debug("[TRANSACTION]", "User rolling back to savepoint", { name });
      await this.transactionService.rollbackToSavepoint(name);
    } catch (e) {
      this.toast.error(`Failed to rollback to savepoint: ${(e as Error).message}`);
    }
  }

  onToggleLog(): void {
    this.showLog.update((v) => !v);
  }

  onUndoLast(): void {
    logger.debug("[TRANSACTION]", "User undoing last operation");
    this.transactionService.undoLastOperation();
  }

  onClearLog(): void {
    logger.debug("[TRANSACTION]", "User clearing operation log");
    this.transactionService.clearOperationLog();
  }
}
