import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class LoggerService {
  debug(message: string, ...args: unknown[]): void {
    console.debug(message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    console.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
  }

  log(message: string, ...args: unknown[]): void {
    console.log(message, ...args);
  }

  logApiCall(
    page: string,
    method: string,
    operation: string,
    data?: Record<string, unknown>
  ): void {
    console.log(`[${page}] API Call: ${method}`, { operation, ...data });
  }

  logDataReceive(
    page: string,
    method: string,
    operation: string,
    data: unknown,
    duration?: number
  ): void {
    console.log(`[${page}] Data Receive: ${method}`, { operation, duration, data });
  }

  logError(
    page: string,
    method: string,
    operation: string,
    error: string,
    duration?: number
  ): void {
    console.error(`[${page}] Error: ${method}`, { operation, error, duration });
  }
}

export const logger = new LoggerService();
