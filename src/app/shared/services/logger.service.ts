import { Injectable, signal, computed, inject } from "@angular/core";
import { SettingsService } from "@shared/services/settings.service";

export type LogLevel = "debug" | "log" | "warn" | "error";

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
}

@Injectable({ providedIn: "root" })
export class LoggerService {
  private readonly settings = inject(SettingsService);
  private readonly logsSignal = signal<LogEntry[]>([]);

  readonly logs = this.logsSignal.asReadonly();
  readonly logCount = computed(() => this.logs().length);

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    log: 1,
    warn: 2,
    error: 3,
  };

  private isProduction(): boolean {
    return this.settings.get("environment") === "production";
  }

  private shouldLog(level: LogLevel): boolean {
    const config = this.settings.get("logging") as
      | { enabled?: boolean; productionLevel?: string }
      | undefined;
    if (!config?.enabled) return true;
    if (this.isProduction()) {
      const minLevel = (config.productionLevel ?? "warn") as LogLevel;
      return this.levelPriority[level] >= this.levelPriority[minLevel];
    }
    return true;
  }

  private createEntry(
    level: LogLevel,
    message: string,
    context?: string,
    data?: unknown
  ): LogEntry {
    return {
      timestamp: new Date(),
      level,
      message,
      context,
      data,
    };
  }

  private storeAndConsole(entry: LogEntry): void {
    this.logsSignal.update((logs) => [entry, ...logs].slice(0, 500));

    const prefix = this.formatPrefix(entry);
    const args = entry.data ? [prefix, entry.data] : [prefix];

    switch (entry.level) {
      case "debug":
        console.debug(...args);
        break;
      case "log":
        console.log(...args);
        break;
      case "warn":
        console.warn(...args);
        break;
      case "error":
        console.error(...args);
        break;
    }
  }

  private formatPrefix(entry: LogEntry): string {
    const ts = entry.timestamp.toISOString();
    const ctx = entry.context ? `[${entry.context}]` : "";
    return `[${ts}] [${entry.level.toUpperCase()}]${ctx} ${entry.message}`;
  }

  debug(message: string, context?: string, data?: unknown): void {
    if (!this.shouldLog("debug")) return;
    this.storeAndConsole(this.createEntry("debug", message, context, data));
  }

  log(message: string, context?: string, data?: unknown): void {
    if (!this.shouldLog("log")) return;
    this.storeAndConsole(this.createEntry("log", message, context, data));
  }

  warn(message: string, context?: string, data?: unknown): void {
    if (!this.shouldLog("warn")) return;
    this.storeAndConsole(this.createEntry("warn", message, context, data));
  }

  error(message: string, context?: string, data?: unknown): void {
    if (!this.shouldLog("error")) return;
    this.storeAndConsole(this.createEntry("error", message, context, data));
  }

  clear(): void {
    this.logsSignal.set([]);
  }
}
