import { Injectable, signal, computed, inject } from "@angular/core";
import { environment } from "../../../environments/environment";

export type LogLevel = "debug" | "info" | "warn" | "error" | "log";

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  timestamp: Date;
  data?: unknown;
}

@Injectable({ providedIn: "root" })
export class LoggingService {
  private logsSignal = signal<LogEntry[]>([]);
  private enabled = environment.logger.enabled;
  private enabledDebug = environment.logger.debug;
  private enabledInfo = environment.logger.info;
  private enabledWarn = environment.logger.warn;
  private enabledError = environment.logger.error;

  readonly logs = computed(() => this.logsSignal());
  readonly logCount = computed(() => this.logsSignal().length);
  readonly isEnabled = signal(true);
  readonly minLevel = signal<LogLevel>("info");

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

  debug(tag: string, message: string, data?: unknown): void {
    if (!this.shouldLog("debug")) return;
    const formatted = this.formatMessage(tag, message);
    this.logInternal("debug", message, tag, data);
    console.debug(formatted, data ?? "");
  }

  info(tag: string, message: string, data?: unknown): void {
    if (!this.shouldLog("info")) return;
    const formatted = this.formatMessage(tag, message);
    this.logInternal("info", message, tag, data);
    console.info(formatted, data ?? "");
  }

  warn(tag: string, message: string, data?: unknown): void {
    if (!this.shouldLog("warn")) return;
    const formatted = this.formatMessage(tag, message);
    this.logInternal("warn", message, tag, data);
    console.warn(formatted, data ?? "");
  }

  error(tag: string, message: string, data?: unknown): void {
    if (!this.shouldLog("error")) return;
    const formatted = this.formatMessage(tag, message);
    this.logInternal("error", message, tag, data);
    console.error(formatted, data ?? "");
  }

  log(tag: string, message: string, data?: unknown): void {
    if (!this.shouldLog("log")) return;
    const formatted = this.formatMessage(tag, message);
    this.logInternal("log", message, tag, data);
    console.log(formatted, data ?? "");
  }

  private logInternal(level: LogLevel, message: string, context?: string, data?: unknown): void {
    const entry: LogEntry = { level, message, context, timestamp: new Date(), data };
    this.logsSignal.update((logs) => [entry, ...logs].slice(0, 1000));
  }

  clearLogs(): void {
    this.logsSignal.set([]);
  }

  getLogs(): LogEntry[] {
    return this.logsSignal();
  }
}
