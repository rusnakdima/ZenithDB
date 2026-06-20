import { Injectable, signal, inject } from "@angular/core";
@Injectable()
export class ConnectionDetailStore {
  readonly loading = signal(false);
  readonly testing = signal(false);
  readonly showAddDbModal = signal(false);
  setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }
  setTesting(isTesting: boolean): void {
    this.testing.set(isTesting);
  }
  openAddDbModal(): void {
    this.showAddDbModal.set(true);
  }
  closeAddDbModal(): void {
    this.showAddDbModal.set(false);
  }
  toggleAddDbModal(): void {
    this.showAddDbModal.update((v) => !v);
  }
}
