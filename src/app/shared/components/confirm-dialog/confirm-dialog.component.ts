import { Component, input, output, signal } from "@angular/core";
import { ModalComponent, ModalSize } from "@shared/components/modal/modal.component";

export type ConfirmIcon = "warning" | "danger" | "info";

@Component({
  selector: "app-confirm-dialog",
  standalone: true,
  imports: [ModalComponent],
  templateUrl: "./confirm-dialog.component.html",
})
export class ConfirmDialogComponent {
  open = input<boolean>(false);
  title = input<string>("Confirm");
  message = input<string>("Are you sure you want to proceed?");
  icon = input<ConfirmIcon>("warning");
  confirmLabel = input<string>("Confirm");
  cancelLabel = input<string>("Cancel");
  confirmVariant = input<"primary" | "danger">("primary");

  confirmed = output<void>();
  cancelled = output<void>();

  onConfirmed(): void {
    this.confirmed.emit();
  }

  onCancelled(): void {
    this.cancelled.emit();
  }

  getIconSvg(): string {
    switch (this.icon()) {
      case "danger":
        return "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z";
      case "info":
        return "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
      case "warning":
      default:
        return "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z";
    }
  }

  getIconColorClass(): string {
    switch (this.icon()) {
      case "danger":
        return "text-red-500";
      case "info":
        return "text-blue-500";
      case "warning":
      default:
        return "text-amber-500";
    }
  }

  getBgColorClass(): string {
    switch (this.icon()) {
      case "danger":
        return "bg-red-100 dark:bg-red-900/30";
      case "info":
        return "bg-blue-100 dark:bg-blue-900/30";
      case "warning":
      default:
        return "bg-amber-100 dark:bg-amber-900/30";
    }
  }
}
