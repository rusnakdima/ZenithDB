import { Injectable, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ConnectionFormService {
  private openSignal = signal(false);
  private editIdSignal = signal<string | null>(null);
  private duplicateSignal = signal(false);

  openNew(): void {
    this.openSignal.set(true);
    this.editIdSignal.set(null);
    this.duplicateSignal.set(false);
  }

  openForEdit(id: string): void {
    this.openSignal.set(true);
    this.editIdSignal.set(id);
    this.duplicateSignal.set(false);
  }

  openForDuplicate(id: string): void {
    this.openSignal.set(true);
    this.editIdSignal.set(id);
    this.duplicateSignal.set(true);
  }

  close(): void {
    this.openSignal.set(false);
    this.editIdSignal.set(null);
    this.duplicateSignal.set(false);
  }

  isOpen = (): boolean => this.openSignal();

  editingId = (): string | null => this.editIdSignal();

  isDuplicate = (): boolean => this.duplicateSignal();
}
