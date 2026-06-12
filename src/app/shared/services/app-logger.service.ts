import { Injectable, inject } from "@angular/core";
import { LoggerService } from "@shared/services/logger.service";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { DiagnosticLoggerService } from "@shared/services/diagnostic-logger.service";
import { environment } from "../../../environments/environment";

type LogLevel = "debug" | "info" | "warn" | "error" | "log";

@Injectable({ providedIn: "root" })
export class AppLoggerService {
  private logger = inject(LoggerService);
  private dataflowLogger = inject(DataflowLoggerService);
  private diagLogger = inject(DiagnosticLoggerService);

  private enabled = environment.logger.enabled;
  private enabledDebug = environment.logger.debug;
  private enabledInfo = environment.logger.info;
  private enabledWarn = environment.logger.warn;
  private enabledError = environment.logger.error;

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;

    switch (level) {
      case "debug":
        return this.enabledDebug;
      case "log":
      case "info":
        return this.enabledInfo;
      case "warn":
        return this.enabledWarn;
      case "error":
        return this.enabledError;
      default:
        return false;
    }
  }

  private formatMessage(tag: string, message: string): string {
    return `[${tag}] ${message}`;
  }

  debug(tag: string, message: string, data?: any): void {
    if (!this.shouldLog("debug")) return;
    const formatted = this.formatMessage(tag, message);
    this.logger.debug(message, tag, data);
    this.dataflowLogger.logUserAction(tag, message, data);
    console.debug(formatted, data ?? "");
  }

  info(tag: string, message: string, data?: any): void {
    if (!this.shouldLog("info")) return;
    const formatted = this.formatMessage(tag, message);
    this.logger.log(message, tag, data);
    this.dataflowLogger.logUserAction(tag, message, data);
    console.info(formatted, data ?? "");
  }

  warn(tag: string, message: string, data?: any): void {
    if (!this.shouldLog("warn")) return;
    const formatted = this.formatMessage(tag, message);
    this.logger.warn(message, tag, data);
    this.dataflowLogger.logUserAction(tag, message, data);
    console.warn(formatted, data ?? "");
  }

  error(tag: string, message: string, data?: any): void {
    if (!this.shouldLog("error")) return;
    const formatted = this.formatMessage(tag, message);
    this.logger.error(message, tag, data);
    this.dataflowLogger.logError(tag, message, "ERROR", message);
    console.error(formatted, data ?? "");
  }

  log(tag: string, message: string, data?: any): void {
    if (!this.shouldLog("log")) return;
    const formatted = this.formatMessage(tag, message);
    this.logger.log(message, tag, data);
    this.dataflowLogger.logUserAction(tag, message, data);
    console.log(formatted, data ?? "");
  }
}
