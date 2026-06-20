import { Injectable, inject } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
export interface ErrorLogEntry {
  id: string;
  message: string;
  context?: string;
  timestamp: Date;
  error?: unknown;
}
@Injectable({ providedIn: "root" })
export class ErrorHandlerService {
  private errors: ErrorLogEntry[] = [];
  handleError(error: unknown, context?: string): void {
    const entry: ErrorLogEntry = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      message: error instanceof Error ? error.message : String(error),
      context,
      timestamp: new Date(),
      error,
    };
    this.errors.unshift(entry);
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(0, 100);
    }
  }
  handleHttpError(error: HttpErrorResponse, context?: string): void {
    const message = `HTTP ${error.status}: ${error.statusText}`;
    this.handleError(new Error(message), context);
  }
  getErrors(): ErrorLogEntry[] {
    return [...this.errors];
  }
  clearErrors(): void {
    this.errors = [];
  }
}
