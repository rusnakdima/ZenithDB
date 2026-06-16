import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class DiagnosticLoggerService {
  debug(message: string, context?: string, data?: any): void {
    console.debug(context ? `[${context}] ${message}` : message, data ?? "");
  }

  info(message: string, context?: string, data?: any): void {
    console.info(context ? `[${context}] ${message}` : message, data ?? "");
  }

  warn(message: string, context?: string, data?: any): void {
    console.warn(context ? `[${context}] ${message}` : message, data ?? "");
  }

  error(message: string, context?: string, data?: any): void {
    console.error(context ? `[${context}] ${message}` : message, data ?? "");
  }

  log(message: string, data?: any): void {
    console.info(message, data ?? "");
  }

  logDataLoad(
    operation: string,
    rowCount: number,
    durationMs: number,
    metadata?: Record<string, any>
  ): void {
    console.info(`[DATA LOAD] ${operation}`, { rowCount, durationMs, ...metadata });
  }
}
