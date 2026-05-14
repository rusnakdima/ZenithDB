import { Injectable, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ConnectionFormService {
  isOpen = signal(false);
  editingId = signal<string | null>(null);
  isDuplicate = signal(false);

  openNew() {
    this.editingId.set(null);
    this.isDuplicate.set(false);
    this.isOpen.set(true);
  }

  openForEdit(id: string) {
    this.editingId.set(id);
    this.isDuplicate.set(false);
    this.isOpen.set(true);
  }

  openForDuplicate(id: string) {
    this.editingId.set(id);
    this.isDuplicate.set(true);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.editingId.set(null);
    this.isDuplicate.set(false);
  }
}
