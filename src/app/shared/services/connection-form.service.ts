import { Injectable, signal, inject } from "@angular/core";
import { AppLoggerService } from "@shared/services/app-logger.service";

@Injectable({ providedIn: "root" })
export class ConnectionFormService {
  private logger = inject(AppLoggerService);
  isOpen = signal(false);
  editingId = signal<string | null>(null);
  isDuplicate = signal(false);

  openNew() {
    this.logger.debug("[CONNECTION_FORM]", "openNew called");
    this.editingId.set(null);
    this.isDuplicate.set(false);
    this.isOpen.set(true);
  }

  openForEdit(id: string) {
    this.logger.debug("[CONNECTION_FORM]", "openForEdit called", { id });
    this.editingId.set(id);
    this.isDuplicate.set(false);
    this.isOpen.set(true);
  }

  openForDuplicate(id: string) {
    this.logger.debug("[CONNECTION_FORM]", "openForDuplicate called", { id });
    this.editingId.set(id);
    this.isDuplicate.set(true);
    this.isOpen.set(true);
  }

  close() {
    this.logger.debug("[CONNECTION_FORM]", "close called");
    this.isOpen.set(false);
    this.editingId.set(null);
    this.isDuplicate.set(false);
  }
}
