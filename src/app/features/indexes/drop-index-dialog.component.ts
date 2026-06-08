import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ModalComponent } from "@shared/components/modal/modal.component";

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
    this.closed.emit();
  }

  onConfirm(): void {
    this.confirm.emit();
  }
}
