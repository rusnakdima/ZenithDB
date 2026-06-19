import { Component, Input, Output, EventEmitter, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { logger } from "@core/services/logger.service";

@Component({
  selector: "app-drop-index-dialog",
  standalone: true,
  imports: [CommonModule, ModalComponent],
  templateUrl: "./drop-index-dialog.component.html",
})
export class DropIndexDialogComponent {
  @Input() indexName = "";

  @Output() closed = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  onCancel(): void {
    logger.debug("[INDEX]", "Drop index dialog cancelled", { indexName: this.indexName });
    this.closed.emit();
  }

  onConfirm(): void {
    logger.info("[INDEX]", "Drop index confirmed", { indexName: this.indexName });
    this.confirm.emit();
  }
}
