import { Injectable, signal, inject } from "@angular/core";

@Injectable()
export class DatabaseDetailStore {
  readonly loading = signal(false);
  readonly totalDocuments = signal(0);
  readonly showCreateCollection = signal(false);

  setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }

  setTotalDocuments(total: number): void {
    this.totalDocuments.set(total);
  }

  openCreateCollectionModal(): void {
    this.showCreateCollection.set(true);
  }

  closeCreateCollectionModal(): void {
    this.showCreateCollection.set(false);
  }

  toggleCreateCollectionModal(): void {
    this.showCreateCollection.update((v) => !v);
  }
}
