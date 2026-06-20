import { Component, inject, computed, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ToastService } from "@services/services.toast.service";
import { ToastComponent } from "../toast/toast.component";
@Component({
  selector: "app-toast-container",
  standalone: true,
  imports: [CommonModule, ToastComponent],
  templateUrl: "./toast-container.component.html",
})
export class ToastContainerComponent {
  private toastService = inject(ToastService);
  protected maxVisible = 5;
  @Input() position:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center" = "top-right";
  visibleToasts = computed(() => {
    return this.toastService.toasts().slice(0, this.maxVisible);
  });
  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }
  get positionClass(): string {
    switch (this.position) {
      case "top-left":
        return "top-4 left-4";
      case "bottom-right":
        return "bottom-4 right-4";
      case "bottom-left":
        return "bottom-4 left-4";
      case "top-center":
        return "top-4 left-1/2 -translate-x-1/2";
      case "bottom-center":
        return "bottom-4 left-1/2 -translate-x-1/2";
      default:
        return "top-4 right-4";
    }
  }
}
