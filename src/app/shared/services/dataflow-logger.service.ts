import { Injectable, signal, computed, inject } from "@angular/core";
import { TauriBridgeService } from "@providers/tauri-bridge.service";
import { getLoggingService } from "@tauri-apps/logger";
import { TauriApiService } from "@app/api/tauri-api.service";

export type DataFlowDirection = "in" | "out" | "user_action";
export type ProblemSeverity = "low" | "medium" | "high" | "critical";

export interface DataFlowEntry {
  id: string;
  timestamp: Date;
  page: string;
  operation: string;
  direction: DataFlowDirection;
  command?: string;
  params?: unknown;
  result?: unknown;
  error?: string;
  durationMs?: number;
  markedAsProblem?: boolean;
  problemDescription?: string;
  problemSeverity?: ProblemSeverity;
  screenshotData?: string;
}

export interface ProblemReport {
  exportedAt: Date;
  appVersion: string;
  summary: {
    totalMarked: number;
    bySeverity: Record<ProblemSeverity, number>;
    byPage: Record<string, number>;
    byOperation: Record<string, number>;
  };
  entries: DataFlowEntry[];
  metadata: {
    os: string;
    browser: string;
    connectionCount: number;
  };
}

@Injectable({ providedIn: "root" })
export class DataflowLoggerService {
  private readonly entriesSignal = signal<DataFlowEntry[]>([]);
  private readonly maxEntries = 1000;
  private callCounter = new Map<string, number>();
  private sampleRate = 10;
  private tauriBridge = inject(TauriBridgeService, { optional: true });
  private tauriApi = inject(TauriApiService);
  private loggingService = getLoggingService();
  private pendingPersistCount = 0;
  private readonly persistThreshold = 100;
  private readonly logDir = ".zenithdb/logs";

  readonly entries = this.entriesSignal.asReadonly();
  readonly entryCount = computed(() => this.entries().length);
  readonly problemCount = computed(() => this.entries().filter((e) => e.markedAsProblem).length);

  constructor() {
    const rate =
      typeof window !== "undefined"
        ? (window as { ZENITH_LOG_SAMPLE_RATE?: string }).ZENITH_LOG_SAMPLE_RATE
        : undefined;
    if (rate) {
      this.sampleRate = parseInt(rate, 10) || 10;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  private redactSensitiveData(data: unknown): unknown {
    if (!data || typeof data !== "object") return data;
    if (Array.isArray(data)) {
      return data.map((item) => this.redactSensitiveData(item));
    }
    const sensitiveKeys = ["password", "secret", "token", "credentials", "uri", "connectionString"];
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        result[key] = "[REDACTED]";
      } else if (value && typeof value === "object") {
        result[key] = this.redactSensitiveData(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private shouldSample(operation: string): boolean {
    const count = this.callCounter.get(operation) || 0;
    this.callCounter.set(operation, count + 1);
    return count % this.sampleRate === 0;
  }

  private createEntry(
    page: string,
    operation: string,
    direction: DataFlowDirection,
    options: {
      command?: string;
      params?: unknown;
      result?: unknown;
      error?: string;
      durationMs?: number;
      sample?: boolean;
    } = {}
  ): DataFlowEntry {
    const entry: DataFlowEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      page,
      operation,
      direction,
      command: options.command,
      params: options.params ? this.redactSensitiveData(options.params) : undefined,
      result: options.result ? this.redactSensitiveData(options.result) : undefined,
      error: options.error,
      durationMs: options.durationMs,
    };

    if (options.sample === false || this.shouldSample(operation)) {
      this.entriesSignal.update((entries) => [entry, ...entries].slice(0, this.maxEntries));
    }

    const prefix = `[${entry.timestamp.toISOString()}] [${direction.toUpperCase()}] [${page}] ${operation}`;
    if (entry.command) {
      console.log(`${prefix} → ${entry.command}`, entry.params || "");
    } else {
      console.log(`${prefix}`, entry.params || "");
    }
    if (entry.error) {
      this.loggingService.error(`${prefix} ERROR:`, entry.page, entry.error);
    }
    if (entry.durationMs !== undefined) {
      console.log(`${prefix} [${entry.durationMs}ms]`);
    }

    return entry;
  }

  logApiCall(page: string, operation: string, command: string, params: unknown): void {
    this.createEntry(page, operation, "in", { command, params });
  }

  logDataReceive(
    page: string,
    operation: string,
    command: string,
    result: unknown,
    durationMs?: number
  ): void {
    this.createEntry(page, operation, "out", { command, result, durationMs });
  }

  logUserAction(page: string, operation: string, params?: unknown): void {
    this.createEntry(page, operation, "user_action", { params });
  }

  logError(
    page: string,
    operation: string,
    command: string,
    error: string,
    durationMs?: number
  ): void {
    this.createEntry(page, operation, "out", { command, error, durationMs });
  }

  logQueryData(
    page: string,
    operation: string,
    command: string,
    params: unknown,
    result: unknown,
    durationMs?: number
  ): void {
    this.createEntry(page, operation, "out", {
      command,
      params,
      result,
      durationMs,
      sample: false,
    });
  }

  markAsProblem(
    id: string,
    description: string,
    severity: ProblemSeverity = "medium",
    screenshotData?: string
  ): void {
    this.entriesSignal.update((entries) =>
      entries.map((e) =>
        e.id === id
          ? {
              ...e,
              markedAsProblem: true,
              problemDescription: description,
              problemSeverity: severity,
              screenshotData,
            }
          : e
      )
    );
    this.checkAndPersist();
  }

  unmarkAsProblem(id: string): void {
    this.entriesSignal.update((entries) =>
      entries.map((e) =>
        e.id === id
          ? {
              ...e,
              markedAsProblem: false,
              problemDescription: undefined,
              problemSeverity: undefined,
              screenshotData: undefined,
            }
          : e
      )
    );
  }

  getMarkedProblems(): DataFlowEntry[] {
    return this.entries().filter((e) => e.markedAsProblem);
  }

  async captureScreenshot(): Promise<string | undefined> {
    try {
      if (this.tauriBridge) {
        const screenshot = await this.tauriApi.invokeRaw<string>("capture_screenshot", {});
        return screenshot;
      }
    } catch {}
    return undefined;
  }

  exportProblems(): ProblemReport {
    const problems = this.getMarkedProblems();
    const bySeverity: Record<ProblemSeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const byPage: Record<string, number> = {};
    const byOperation: Record<string, number> = {};

    for (const p of problems) {
      if (p.problemSeverity) bySeverity[p.problemSeverity]++;
      byPage[p.page] = (byPage[p.page] || 0) + 1;
      byOperation[p.operation] = (byOperation[p.operation] || 0) + 1;
    }

    return {
      exportedAt: new Date(),
      appVersion: "1.0.0",
      summary: {
        totalMarked: problems.length,
        bySeverity,
        byPage,
        byOperation,
      },
      entries: problems,
      metadata: {
        os: navigator.platform,
        browser: navigator.userAgent,
        connectionCount: 0,
      },
    };
  }

  async exportLogs(): Promise<string> {
    const data = JSON.stringify(this.entries(), null, 2);
    if (this.tauriBridge) {
      try {
        const path = await this.tauriApi.invokeRaw<string>("save_log_file", {
          filename: `dataflow-${new Date().toISOString().split("T")[0]}.json`,
          content: data,
        });
        return path;
      } catch {}
    }
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dataflow-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return url;
  }

  private async checkAndPersist(): Promise<void> {
    this.pendingPersistCount++;
    if (this.pendingPersistCount >= this.persistThreshold) {
      const entriesToPersist = this.entries().slice(0, this.persistThreshold);
      await this.persistLogs(entriesToPersist);
      this.pendingPersistCount = 0;
    }
  }

  private getLogFilename(date: Date): string {
    return `dataflow-${date.toISOString().split("T")[0]}.jsonl`;
  }

  private getLogPath(date: Date): string {
    return `${this.logDir}/${this.getLogFilename(date)}`;
  }

  async saveLogEntry(entry: DataFlowEntry): Promise<void> {
    if (!this.tauriBridge) return;
    try {
      const entryLine = JSON.stringify(entry) + "\n";
      await this.tauriApi.invokeRaw("append_log_file", {
        filename: this.getLogPath(entry.timestamp),
        content: entryLine,
      });
    } catch {}
  }

  async persistLogs(entries: DataFlowEntry[]): Promise<void> {
    if (!this.tauriBridge || entries.length === 0) return;
    try {
      const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      const date =
        entries[0].timestamp instanceof Date
          ? entries[0].timestamp
          : new Date(entries[0].timestamp);
      await this.tauriApi.invokeRaw("append_log_file", {
        filename: this.getLogPath(date),
        content,
      });
    } catch {}
  }

  async loadRecentLogs(date?: Date, maxEntries: number = 1000): Promise<DataFlowEntry[]> {
    if (!this.tauriBridge) return [];
    try {
      const targetDate = date || new Date();
      const entries = await this.tauriApi.invokeRaw<string[]>("read_log_file", {
        filename: this.getLogPath(targetDate),
      });
      return entries
        .map((line) => {
          try {
            return JSON.parse(line) as DataFlowEntry;
          } catch {
            return null;
          }
        })
        .filter((e): e is DataFlowEntry => e !== null)
        .slice(-maxEntries);
    } catch {
      return [];
    }
  }

  async flushLogs(): Promise<void> {
    if (this.entries().length === 0) return;
    const entries = this.entries();
    const byDate = new Map<string, DataFlowEntry[]>();
    for (const entry of entries) {
      const dateKey =
        entry.timestamp instanceof Date
          ? entry.timestamp.toISOString().split("T")[0]
          : new Date(entry.timestamp).toISOString().split("T")[0];
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey)!.push(entry);
    }
    if (this.tauriBridge) {
      try {
        for (const [dateStr, dateEntries] of byDate) {
          const content = dateEntries.map((e) => JSON.stringify(e)).join("\n") + "\n";
          await this.tauriApi.invokeRaw("append_log_file", {
            filename: this.getLogPath(new Date(dateStr)),
            content,
          });
        }
      } catch {}
    }
    this.pendingPersistCount = 0;
  }

  clear(): void {
    this.entriesSignal.set([]);
    this.callCounter.clear();
  }

  getEntriesByPage(page: string): DataFlowEntry[] {
    return this.entries().filter((e) => e.page === page);
  }

  getEntriesByOperation(operation: string): DataFlowEntry[] {
    return this.entries().filter((e) => e.operation === operation);
  }

  getEntriesByDirection(direction: DataFlowDirection): DataFlowEntry[] {
    return this.entries().filter((e) => e.direction === direction);
  }
}
