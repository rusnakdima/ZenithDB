import { Injectable, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export abstract class BaseStorageService {
  protected loading = signal(false);
  protected error = signal<string | null>(null);

  isLoading() {
    return this.loading();
  }

  getError() {
    return this.error();
  }

  clearError() {
    this.error.set(null);
  }

  protected setLoading(value: boolean) {
    this.loading.set(value);
  }

  protected setError(err: string | null) {
    this.error.set(err);
  }
}
