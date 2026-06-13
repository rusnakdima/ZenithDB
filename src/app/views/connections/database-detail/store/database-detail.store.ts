import { Injectable, signal, inject } from "@angular/core";
import { LoggingService } from "@shared/services/logging.service";

@Injectable()
export class DatabaseDetailStore {
  private logger = inject(LoggingService);

  readonly loading = signal(false);
  readonly totalDocuments = signal(0);
  readonly showCreateCollection = signal(false);

  setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
    this.logger.debug("[DATABASE_DETAIL_STORE]", "Loading state changed", { isLoading });
  }

  setTotalDocuments(total: number): void {
    this.totalDocuments.set(total);
    this.logger.debug("[DATABASE_DETAIL_STORE]", "Total documents updated", { total });
  }

  openCreateCollectionModal(): void {
    this.showCreateCollection.set(true);
    this.logger.debug("[DATABASE_DETAIL_STORE]", "Create collection modal opened");
  }

  closeCreateCollectionModal(): void {
    this.showCreateCollection.set(false);
    this.logger.debug("[DATABASE_DETAIL_STORE]", "Create collection modal closed");
  }

  toggleCreateCollectionModal(): void {
    this.showCreateCollection.update((v) => !v);
    this.logger.debug("[DATABASE_DETAIL_STORE]", "Create collection modal toggled", {
      isOpen: this.showCreateCollection(),
    });
  }
}
