import { Injectable, signal, inject } from "@angular/core";
import { getLoggingService } from "@tauri-apps/logger";

@Injectable()
export class ConnectionDetailStore {
  private logger = getLoggingService();

  readonly loading = signal(false);
  readonly testing = signal(false);
  readonly showAddDbModal = signal(false);

  setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
    this.logger.debug("[CONNECTION_DETAIL_STORE]", "Loading state changed", { isLoading });
  }

  setTesting(isTesting: boolean): void {
    this.testing.set(isTesting);
    this.logger.debug("[CONNECTION_DETAIL_STORE]", "Testing state changed", { isTesting });
  }

  openAddDbModal(): void {
    this.showAddDbModal.set(true);
    this.logger.debug("[CONNECTION_DETAIL_STORE]", "Add DB modal opened");
  }

  closeAddDbModal(): void {
    this.showAddDbModal.set(false);
    this.logger.debug("[CONNECTION_DETAIL_STORE]", "Add DB modal closed");
  }

  toggleAddDbModal(): void {
    this.showAddDbModal.update((v) => !v);
    this.logger.debug("[CONNECTION_DETAIL_STORE]", "Add DB modal toggled", {
      isOpen: this.showAddDbModal(),
    });
  }
}
