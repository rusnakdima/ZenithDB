import { Component, signal, inject } from "@angular/core";
import { ToastService } from "@services/toast.service";
import { MatIconModule } from "@angular/material/icon";

@Component({
  selector: "app-error-boundary",
  standalone: true,
  imports: [MatIconModule],
  templateUrl: "./error-boundary.component.html",
})
export class ErrorBoundaryComponent {
  private toastService = inject(ToastService);

  hasError = signal(false);
  errorMessage = signal("");

  showError(message: string) {
    this.hasError.set(true);
    this.errorMessage.set(message);
  }

  retry() {
    this.hasError.set(false);
    this.errorMessage.set("");
    window.location.reload();
  }

  dismiss() {
    this.hasError.set(false);
  }
}
