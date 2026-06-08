import { Component, inject, signal, computed, ChangeDetectionStrategy } from "@angular/core";
import { TitleCasePipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { AutoTransactionService, PendingOperation } from "./auto-transaction.service";
import { ConfirmService } from "@shared/services/confirm.service";
import { ToastService } from "@services/toast.service";

@Component({
  selector: "app-batch-transaction",
  standalone: true,
  imports: [TitleCasePipe, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./batch-transaction.component.html",
})
export class BatchTransactionComponent {
  private autoTransactionService = inject(AutoTransactionService);
  private confirmService = inject(ConfirmService);
  private toast = inject(ToastService);

  queue = this.autoTransactionService.queue;
  queueCount = this.autoTransactionService.queueCount;
  error = this.autoTransactionService.error;
  pendingByCollection = this.autoTransactionService.pendingByCollection;

  isCommitting = signal(false);
  expandedCollections = signal<Set<string>>(new Set());

  collectionsList = computed(() => Array.from(this.pendingByCollection().keys()));

  async onCommitAll(): Promise<void> {
    if (this.queueCount() === 0) return;

    const confirmed = await this.confirmService.confirm({
      title: "Commit Batch",
      message: `Are you sure you want to commit ${this.queueCount()} operations?`,
      confirmText: "Commit All",
    });

    if (!confirmed) return;

    this.isCommitting.set(true);
    try {
      const success = await this.autoTransactionService.commitAll();
      if (success) {
        // Success handled in service
      }
    } finally {
      this.isCommitting.set(false);
    }
  }

  async onClearQueue(): Promise<void> {
    if (this.queueCount() === 0) return;

    const confirmed = await this.confirmService.confirm({
      title: "Clear Queue",
      message: "Are you sure you want to clear all pending operations?",
      confirmText: "Clear",
    });

    if (!confirmed) return;

    this.autoTransactionService.clearQueue();
    this.toast.info("Queue cleared");
  }

  onRemoveOperation(operationId: string): void {
    this.autoTransactionService.removeFromQueue(operationId);
  }

  onToggleCollection(collection: string): void {
    this.expandedCollections.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(collection)) {
        newSet.delete(collection);
      } else {
        newSet.add(collection);
      }
      return newSet;
    });
  }

  isCollectionExpanded(collection: string): boolean {
    return this.expandedCollections().has(collection);
  }

  getCollectionOperations(collection: string): PendingOperation[] {
    return this.pendingByCollection().get(collection) || [];
  }

  getOperationIcon(type: PendingOperation["type"]): string {
    return this.autoTransactionService.getOperationIcon(type);
  }

  getOperationClass(type: PendingOperation["type"]): string {
    return this.autoTransactionService.getOperationClass(type);
  }
}
