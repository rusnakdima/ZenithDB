import { Injectable, inject, signal, computed } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { ToastService } from "@services/toast.service";
import { LoadingService } from "@shared/services/loading.service";
import {
  AppError,
  ErrorCode,
  ErrorResponse,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  ErrorLogEntry,
} from "@shared/models/error.model";

@Injectable({
  providedIn: "root",
})
export class ErrorHandlerService {
  private toastService = inject(ToastService);
  private loadingService = inject(LoadingService);

  private errorsSignal = signal<AppError[]>([]);
  private logsSignal = signal<ErrorLogEntry[]>([]);
  private isOnlineSignal = signal(navigator.onLine);

  readonly errors = computed(() => this.errorsSignal());
  readonly logs = computed(() => this.logsSignal());
  readonly isOnline = computed(() => this.isOnlineSignal());

  constructor() {
    window.addEventListener("online", () => this.isOnlineSignal.set(true));
    window.addEventListener("offline", () => this.isOnlineSignal.set(false));
  }

  handleError(error: unknown, context?: string): AppError {
    const appError = this.convertToAppError(error);
    this.logError(appError, context);

    if (!appError.retryable) {
      this.toastService.error(appError.userMessage);
    }

    return appError;
  }

  handleHttpError(error: HttpErrorResponse, context?: string): AppError {
    const appError = this.convertHttpError(error);
    this.logError(appError, context);

    if (appError.code === ErrorCode.OFFLINE) {
      this.toastService.error(appError.userMessage, { persistent: true });
    } else {
      this.toastService.error(appError.userMessage);
    }

    return appError;
  }

  convertToAppError(error: unknown): AppError {
    if (error instanceof HttpErrorResponse) {
      return this.convertHttpError(error);
    }

    if (error instanceof Error) {
      return {
        code: ErrorCode.UNKNOWN,
        message: error.message,
        userMessage: "An unexpected error occurred. Please try again.",
        originalError: error,
        timestamp: new Date(),
        retryable: true,
      };
    }

    return {
      code: ErrorCode.UNKNOWN,
      message: String(error),
      userMessage: "An unexpected error occurred. Please try again.",
      timestamp: new Date(),
      retryable: true,
    };
  }

  convertHttpError(error: HttpErrorResponse): AppError {
    if (!navigator.onLine) {
      return {
        code: ErrorCode.OFFLINE,
        message: "No internet connection",
        userMessage: "You are offline. Please check your internet connection.",
        originalError: error,
        timestamp: new Date(),
        retryable: true,
      };
    }

    switch (error.status) {
      case 0:
        return {
          code: ErrorCode.NETWORK_ERROR,
          message: error.message || "Network request failed",
          userMessage: "Network request failed. Please check your connection.",
          originalError: error,
          timestamp: new Date(),
          retryable: true,
        };
      case 400:
        return this.parseErrorResponse(error, ErrorCode.VALIDATION_ERROR, "Invalid request. Please check your input.");
      case 401:
        return this.parseErrorResponse(error, ErrorCode.UNAUTHORIZED, "Authentication required. Please log in.");
      case 403:
        return this.parseErrorResponse(error, ErrorCode.FORBIDDEN, "You don't have permission to perform this action.");
      case 404:
        return this.parseErrorResponse(error, ErrorCode.NOT_FOUND, "The requested resource was not found.");
      case 408:
        return this.parseErrorResponse(error, ErrorCode.TIMEOUT, "Request timed out. Please try again.");
      case 500:
        return this.parseErrorResponse(error, ErrorCode.SERVER_ERROR, "Server error. Please try again later.");
      case 502:
      case 503:
      case 504:
        return this.parseErrorResponse(error, ErrorCode.SERVER_ERROR, "Service temporarily unavailable. Please try again later.");
      default:
        return this.parseErrorResponse(error, ErrorCode.UNKNOWN, "An error occurred. Please try again.");
    }
  }

  private parseErrorResponse(error: HttpErrorResponse, defaultCode: ErrorCode, defaultMessage: string): AppError {
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
      details,
      originalError: error,
      timestamp: new Date(),
      retryable: code !== ErrorCode.FORBIDDEN && code !== ErrorCode.UNAUTHORIZED,
    };
  }

  async retry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: string
  ): Promise<T> {
    const { maxAttempts, delayMs, backoffMultiplier } = { ...DEFAULT_RETRY_CONFIG, ...config };

    let lastError: AppError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.handleError(error, context);
        if (!lastError.retryable || attempt === maxAttempts) {
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

  addError(error: AppError): void {
    this.errorsSignal.update((errors) => [error, ...errors].slice(0, 10));
  }

  clearErrors(): void {
    this.errorsSignal.set([]);
  }

  dismissError(index: number): void {
    this.errorsSignal.update((errors) => errors.filter((_, i) => i !== index));
  }

  private logError(error: AppError, context?: string): void {
    const entry: ErrorLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      error,
      context,
      timestamp: new Date(),
    };
    this.logsSignal.update((logs) => [entry, ...logs].slice(0, 100));

    if (typeof console !== "undefined") {
      console.error(`[ErrorHandler${context ? `][${context}]` : ""}]`, {
        code: error.code,
        message: error.message,
        timestamp: error.timestamp,
      });
    }
  }

  clearLogs(): void {
    this.logsSignal.set([]);
  }
}
