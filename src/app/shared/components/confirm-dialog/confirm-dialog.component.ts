import { Component, inject } from "@angular/core";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { ConfirmService } from "@shared/services/confirm.service";
@Component({
  selector: "app-confirm-dialog",
  standalone: true,
  imports: [ModalComponent],
  templateUrl: "./confirm-dialog.component.html",
})
export class ConfirmDialogComponent {
  confirmService = inject(ConfirmService);
  get options() {
    return this.confirmService.options();
  }
  get isOpen() {
    return this.confirmService.isOpen();
  }
  onConfirm(): void {
    this.confirmService.confirmResult(true);
  }
  onCancel(): void {
    this.confirmService.confirmResult(false);
  }
}
