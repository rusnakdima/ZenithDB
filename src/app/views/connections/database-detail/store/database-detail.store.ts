import { Injectable, signal, inject } from "@angular/core";
import { logger } from "../../../../services/logger.service";

@Injectable()
export class DatabaseDetailStore {
  

  readonly loading = signal(false);
  readonly totalDocuments = signal(0);
  readonly showCreateCollection = signal(false);

  setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
    logger.debug("[DATABASE_DETAIL_STORE]", "Loading state changed", { isLoading });
  }

  setTotalDocuments(total: number): void {
    this.totalDocuments.set(total);
    logger.debug("[DATABASE_DETAIL_STORE]", "Total documents updated", { total });
  }

  openCreateCollectionModal(): void {
    this.showCreateCollection.set(true);
    logger.debug("[DATABASE_DETAIL_STORE]", "Create collection modal opened");
  }

  closeCreateCollectionModal(): void {
    this.showCreateCollection.set(false);
    logger.debug("[DATABASE_DETAIL_STORE]", "Create collection modal closed");
  }

  toggleCreateCollectionModal(): void {
    this.showCreateCollection.update((v) => !v);
    logger.debug("[DATABASE_DETAIL_STORE]", "Create collection modal toggled", {
      isOpen: this.showCreateCollection(),
    });
  }
}
