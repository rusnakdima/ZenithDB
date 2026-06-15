import { Component, Output, EventEmitter, inject, ChangeDetectionStrategy } from "@angular/core";
import { TitleCasePipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { TransactionService, TransactionOperation } from "./transaction.service";
import { getLoggingService } from "@tauri-apps/logger";

@Component({
  selector: "app-transaction-log",
  standalone: true,
  imports: [TitleCasePipe, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./transaction-log.component.html",
})
export class TransactionLogComponent {
  private transactionService = inject(TransactionService);
  private logger = getLoggingService();

  @Output() close = new EventEmitter<void>();

  operationLog = this.transactionService.operationLog;

  onClose(): void {
    this.close.emit();
  }

  onUndoOperation(index: number): void {
    const operations = this.operationLog();
    if (index >= operations.length - 1) {
      this.logger.debug("[TRANSACTION]", "Undoing last operation");
      this.transactionService.undoLastOperation();
    }
  }

  onClearLog(): void {
    this.logger.debug("[TRANSACTION]", "Clearing operation log");
    this.transactionService.clearOperationLog();
  }

  getOperationIcon(type: TransactionOperation["type"]): string {
    const iconMap: Record<TransactionOperation["type"], string> = {
      insert: "add",
      update: "edit",
      delete: "delete",
      soft_delete: "delete_outline",
    };
    return iconMap[type] || "circle";
  }

  getOperationClass(type: TransactionOperation["type"]): string {
    const classMap: Record<TransactionOperation["type"], string> = {
      insert: "text-green-400",
      update: "text-blue-400",
      delete: "text-red-400",
      soft_delete: "text-orange-400",
    };
    return classMap[type] || "text-[var(--text-main)]";
  }

  formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString();
  }
}
