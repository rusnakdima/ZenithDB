import { HttpErrorResponse } from "@angular/common/http";
import { Injectable, inject, signal, computed, DestroyRef } from "@angular/core";
import { ErrorCode, AppError } from "@shared/models/error.model";
import { logger } from "../../services/logger.service";

export interface ToastMessage {
  id: string;
  message: string;
  type: "error" | "warning" | "info" | "success";
  duration: number;
}

export interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
    details?: string;
  };
  message?: string;
  status?: number;
}

export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
};

export interface ErrorLogEntry {
  id: string;
  error: AppError;
  context?: string;
  timestamp: Date;
}

function generateLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

@Injectable({
  providedIn: "root",
})
export class ErrorHandlerService {
  private loggerRef = logger;
  private destroyRef = inject(DestroyRef);
  private toastCounter = 0;

  private errorsSignal = signal<AppError[]>([]);
  private logsSignal = signal<ErrorLogEntry[]>([]);
  private isOnlineSignal = signal(navigator.onLine);
  private toastsSignal = signal<ToastMessage[]>([]);

  readonly errors = computed(() => this.errorsSignal());
  readonly logs = computed(() => this.logsSignal());
  readonly isOnline = computed(() => this.isOnlineSignal());
  readonly toasts = computed(() => this.toastsSignal());

  constructor() {
    const boundOnline = () => this.isOnlineSignal.set(true);
    const boundOffline = () => this.isOnlineSignal.set(false);
    window.addEventListener("online", boundOnline);
    window.addEventListener("offline", boundOffline);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener("online", boundOnline);
      window.removeEventListener("offline", boundOffline);
    });
  }

  handleError(error: unknown, context?: string): AppError {
    this.loggerRef.debug("[ERROR_HANDLER]", "handleError started", { context });
    const appError = this.normalizeError(error, context);
    this.logError(appError, context);

    if (this.shouldShowToast(appError)) {
      this.showToast(appError);
    }

    this.loggerRef.debug("[ERROR_HANDLER]", "handleError completed", {
      code: appError.code,
      retryable: appError.retryable,
    });
    return appError;
  }

  handleHttpError(error: HttpErrorResponse, context?: string): AppError {
    this.loggerRef.debug("[ERROR_HANDLER]", "handleHttpError started", {
      status: error.status,
      context,
    });
    const appError = this.convertHttpError(error);
    this.logError(appError, context);

    this.showToast(appError);

    this.loggerRef.debug("[ERROR_HANDLER]", "handleHttpError completed", { code: appError.code });
    return appError;
  }

  private shouldShowToast(error: AppError): boolean {
    if (error.code === ErrorCode.TIMEOUT) return false;
    if (error.code === ErrorCode.CONNECTION_FAILED) return true;
    return error.code !== ErrorCode.UNKNOWN;
  }

  private showToast(appError: AppError): void {
    const id = `toast_${++this.toastCounter}`;
    const message = appError.message;
    const type = this.getToastType(appError.code);

    const toast: ToastMessage = {
      id,
      message,
      type,
      duration: type === "error" ? 5000 : 3000,
    };

    this.toastsSignal.update((toasts) => [...toasts, toast]);

    setTimeout(() => {
      this.dismissToast(id);
    }, toast.duration);
  }

  private getToastType(code: ErrorCode): ToastMessage["type"] {
    switch (code) {
      case ErrorCode.FORBIDDEN:
        return "warning";
      case ErrorCode.NOT_FOUND:
        return "warning";
      default:
        return "error";
    }
  }

  dismissToast(id: string): void {
    this.toastsSignal.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  clearToasts(): void {
    this.toastsSignal.set([]);
  }

  private normalizeError(error: unknown, context?: string): AppError {
    const timestamp = new Date();

    if (error instanceof HttpErrorResponse) {
      return this.convertHttpError(error);
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      code: ErrorCode.UNKNOWN,
      message: `An unexpected error occurred: ${message}`,
      userMessage: message,
      timestamp,
      retryable: false,
    };
  }

  private convertHttpError(error: HttpErrorResponse): AppError {
    if (!navigator.onLine) {
      return {
        code: ErrorCode.CONNECTION_FAILED,
        message: "No internet connection",
        userMessage: "No internet connection",
        timestamp: new Date(),
        retryable: true,
      };
    }

    switch (error.status) {
      case 0:
        return {
          code: ErrorCode.CONNECTION_FAILED,
          message: error.message || "Network request failed",
          userMessage: error.message || "Network request failed",
          timestamp: new Date(),
          retryable: true,
        };
      case 400:
        return this.parseErrorResponse(
          error,
          ErrorCode.VALIDATION_ERROR,
          "Invalid request. Please check your input."
        );
      case 401:
        return this.parseErrorResponse(
          error,
          ErrorCode.UNAUTHORIZED,
          "Authentication required. Please log in."
        );
      case 403:
        return this.parseErrorResponse(
          error,
          ErrorCode.FORBIDDEN,
          "You don't have permission to perform this action."
        );
      case 404:
        return this.parseErrorResponse(
          error,
          ErrorCode.NOT_FOUND,
          "The requested resource was not found."
        );
      case 408:
        return this.parseErrorResponse(
          error,
          ErrorCode.TIMEOUT,
          "Request timed out. Please try again."
        );
      case 500:
        return this.parseErrorResponse(
          error,
          ErrorCode.SERVER_ERROR,
          "Server error. Please try again later."
        );
      case 502:
      case 503:
      case 504:
        return this.parseErrorResponse(
          error,
          ErrorCode.SERVER_ERROR,
          "Service temporarily unavailable. Please try again later."
        );
      default:
        return this.parseErrorResponse(
          error,
          ErrorCode.UNKNOWN,
          "An error occurred. Please try again."
        );
    }
  }

  private parseErrorResponse(
    error: HttpErrorResponse,
    defaultCode: ErrorCode,
    defaultMessage: string
  ): AppError {
    let userMessage = defaultMessage;
    let details: string | undefined;
    let code = defaultCode;

    if (error.error) {
      const errorResp = error.error as ErrorResponse;
      if (errorResp.error?.message) {
        userMessage = errorResp.error.message;
      } else if (errorResp.message) {
        userMessage = errorResp.message;
      }
      details = errorResp.error?.details;
    }

    return {
      code,
      message: error.message || defaultMessage,
      userMessage,
      timestamp: new Date(),
      retryable: code !== ErrorCode.FORBIDDEN && code !== ErrorCode.UNAUTHORIZED,
    };
  }

  async retry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: string
  ): Promise<T> {
    this.loggerRef.debug("[ERROR_HANDLER]", "retry started", {
      maxAttempts: config.maxAttempts,
      context,
    });
    const { maxAttempts, delayMs, backoffMultiplier } = { ...DEFAULT_RETRY_CONFIG, ...config };

    let lastError: AppError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        this.loggerRef.debug("[ERROR_HANDLER]", "retry completed", { attempt });
        return result;
      } catch (error) {
        lastError = this.handleError(error, context);
        if (!lastError.retryable || attempt === maxAttempts) {
          this.loggerRef.error("[ERROR_HANDLER]", "retry failed", { attempt });
          throw lastError;
        }

        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private logError(error: AppError, context?: string): void {
    const entry: ErrorLogEntry = {
      id: generateLogId(),
      error,
      context,
      timestamp: new Date(),
    };
    this.logsSignal.update((logs) => [entry, ...logs].slice(0, 100));
    this.errorsSignal.update((errors) => [error, ...errors].slice(0, 100));

    this.loggerRef.error("[ERROR_HANDLER]", "Error logged", { code: error.code, context });
  }
}
