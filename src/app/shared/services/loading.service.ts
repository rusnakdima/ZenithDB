import { Injectable, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class LoadingService {
  isLoading = signal(false);
  loadingMessage = signal<string | null>(null);

  show(message?: string): void {
    this.isLoading.set(true);
    if (message) {
      this.loadingMessage.set(message);
    }
  }

  hide(): void {
    this.isLoading.set(false);
    this.loadingMessage.set(null);
  }

  setMessage(msg: string | null): void {
    this.loadingMessage.set(msg);
  }
}