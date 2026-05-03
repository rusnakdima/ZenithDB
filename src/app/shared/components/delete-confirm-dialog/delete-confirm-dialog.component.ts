import { Component, input, output, signal, computed } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ConfirmDialogComponent } from "@shared/components/confirm-dialog/confirm-dialog.component";

@Component({
  selector: "app-delete-confirm-dialog",
  standalone: true,
  imports: [ConfirmDialogComponent, FormsModule],
  templateUrl: "./delete-confirm-dialog.component.html",
})
export class DeleteConfirmDialogComponent {
  open = input<boolean>(false);
  itemName = input<string>("");
  itemType = input<string>("item");

  deleted = output<void>();
  cancelled = output<void>();

  enteredName = signal("");

  isValid = computed(() => this.enteredName() === this.itemName());

  onCancelled(): void {
    this.enteredName.set("");
    this.cancelled.emit();
  }

  onDeleted(): void {
    if (this.isValid()) {
      this.enteredName.set("");
      this.deleted.emit();
    }
  }

  onNameInput(event: Event): void {
    this.enteredName.set((event.target as HTMLInputElement).value);
  }
}
