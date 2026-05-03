import { Component, input, output, OnInit, OnDestroy, inject } from "@angular/core";
import { AppError } from "@shared/models/error.model";
import { ErrorHandlerService } from "@shared/services/error-handler.service";

@Component({
  selector: "app-error-banner",
  standalone: true,
  templateUrl: "./error-banner.component.html",
})
export class ErrorBannerComponent implements OnInit, OnDestroy {
  error = input.required<AppError>();
  dismiss = output<void>();
  retry = output<void>();

  private errorHandler = inject(ErrorHandlerService);
  private autoDismissTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.startAutoDismiss();
  }

  ngOnDestroy(): void {
    this.clearAutoDismiss();
  }

  onDismiss(): void {
    this.clearAutoDismiss();
    this.dismiss.emit();
  }

  onRetry(): void {
    this.clearAutoDismiss();
    this.retry.emit();
  }

  get isOnline(): boolean {
    return this.errorHandler.isOnline();
  }

  private startAutoDismiss(): void {
    this.autoDismissTimeout = setTimeout(() => {
      this.onDismiss();
    }, 10000);
  }

  private clearAutoDismiss(): void {
    if (this.autoDismissTimeout) {
      clearTimeout(this.autoDismissTimeout);
      this.autoDismissTimeout = null;
    }
  }
}
