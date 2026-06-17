import { Injectable, signal, inject } from "@angular/core";
import { logger } from "../../../../services/logger.service";

@Injectable()
export class ConnectionDetailStore {
  readonly loading = signal(false);
  readonly testing = signal(false);
  readonly showAddDbModal = signal(false);

  setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
    logger.debug("[CONNECTION_DETAIL_STORE]", "Loading state changed", { isLoading });
  }

  setTesting(isTesting: boolean): void {
    this.testing.set(isTesting);
    logger.debug("[CONNECTION_DETAIL_STORE]", "Testing state changed", { isTesting });
  }

  openAddDbModal(): void {
    this.showAddDbModal.set(true);
    logger.debug("[CONNECTION_DETAIL_STORE]", "Add DB modal opened");
  }

  closeAddDbModal(): void {
    this.showAddDbModal.set(false);
    logger.debug("[CONNECTION_DETAIL_STORE]", "Add DB modal closed");
  }

  toggleAddDbModal(): void {
    this.showAddDbModal.update((v) => !v);
    logger.debug("[CONNECTION_DETAIL_STORE]", "Add DB modal toggled", {
      isOpen: this.showAddDbModal(),
    });
  }
}
