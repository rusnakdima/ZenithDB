import { Component, input, output, ErrorHandler, OnInit, inject } from "@angular/core";
import { ToastService } from "@services/toast.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";

@Component({
  selector: "app-error-boundary",
  standalone: true,
  templateUrl: "./error-boundary.component.html",
})
export class ErrorBoundaryComponent {
  fallbackTitle = input<string>("Something went wrong");
  fallbackMessage = input<string>("An unexpected error occurred while rendering this component.");

  errorOccurred = output<Error>();
  reset = output<void>();

  hasError = false;
  errorMessage = "";

  handleError(error: Error): void {
    this.hasError = true;
    this.errorMessage = error.message;
    this.errorOccurred.emit(error);

    inject(ErrorHandlerService).handleError(error, "ErrorBoundary");
    inject(ToastService).error("A component error occurred. Please try again.");
  }

  onReset(): void {
    this.hasError = false;
    this.errorMessage = "";
    this.reset.emit();
  }
}
