import { Injectable, signal, computed } from "@angular/core";

export type DataFlowDirection = "in" | "out" | "user_action";
export type ProblemSeverity = "critical" | "high" | "medium" | "low";

export interface DataFlowEntry {
  id: string;
  direction: DataFlowDirection;
  page: string;
  operation: string;
  command?: string;
  error?: string;
  durationMs?: number;
  timestamp: Date;
  markedAsProblem: boolean;
  problemDescription?: string;
  problemSeverity?: ProblemSeverity;
  screenshot?: string;
}

@Injectable({ providedIn: "root" })
export class DataflowLoggerService {
  private entriesSignal = signal<DataFlowEntry[]>([]);

  entryCount = computed(() => this.entriesSignal().length);

  problemCount = computed(() => this.entriesSignal().filter((e) => e.markedAsProblem).length);

  entries = computed(() => this.entriesSignal());

  debug(message: string, context?: string, data?: any): void {
    console.debug(message, context, data);
  }

  info(message: string, context?: string, data?: any): void {
    console.info(message, context, data);
  }

  warn(message: string, context?: string, data?: any): void {
    console.warn(message, context, data);
  }

  error(message: string, context?: string, data?: any): void {
    console.error(message, context, data);
  }

  log(message: string, data?: any): void {
    console.info(message, data);
  }

  logApiCall(page: string, operation: string, apiName: string, params: Record<string, any>): void {
    this.entriesSignal.update((ents) => [
      ...ents,
      {
        id: crypto.randomUUID(),
        direction: "out" as DataFlowDirection,
        page,
        operation,
        command: apiName,
        timestamp: new Date(),
        markedAsProblem: false,
      },
    ]);
  }

  logDataReceive(
    page: string,
    operation: string,
    apiName: string,
    result?: any,
    duration?: number
  ): void {
    this.entriesSignal.update((ents) => [
      ...ents,
      {
        id: crypto.randomUUID(),
        direction: "in" as DataFlowDirection,
        page,
        operation,
        command: apiName,
        durationMs: duration,
        timestamp: new Date(),
        markedAsProblem: false,
      },
    ]);
  }

  logQueryData(
    page: string,
    operation: string,
    apiName: string,
    params: Record<string, any>,
    data?: any,
    duration?: number
  ): void {
    this.entriesSignal.update((ents) => [
      ...ents,
      {
        id: crypto.randomUUID(),
        direction: "in" as DataFlowDirection,
        page,
        operation,
        command: apiName,
        durationMs: duration,
        timestamp: new Date(),
        markedAsProblem: false,
      },
    ]);
  }

  logError(
    page: string,
    operation: string,
    apiName: string,
    error: string,
    duration?: number
  ): void {
    this.entriesSignal.update((ents) => [
      ...ents,
      {
        id: crypto.randomUUID(),
        direction: "in" as DataFlowDirection,
        page,
        operation,
        command: apiName,
        error,
        durationMs: duration,
        timestamp: new Date(),
        markedAsProblem: false,
      },
    ]);
  }

  logUserAction(page: string, operation: string, data?: Record<string, any>): void {
    this.entriesSignal.update((ents) => [
      ...ents,
      {
        id: crypto.randomUUID(),
        direction: "user_action" as DataFlowDirection,
        page,
        operation,
        timestamp: new Date(),
        markedAsProblem: false,
      },
    ]);
  }

  clear(): void {
    this.entriesSignal.set([]);
  }

  captureScreenshot(): string {
    return "";
  }

  markAsProblem(
    id: string,
    description: string,
    severity: ProblemSeverity,
    screenshot?: string
  ): void {
    this.entriesSignal.update((ents) =>
      ents.map((e) =>
        e.id === id
          ? {
              ...e,
              markedAsProblem: true,
              problemDescription: description,
              problemSeverity: severity,
              screenshot,
            }
          : e
      )
    );
  }

  unmarkAsProblem(id: string): void {
    this.entriesSignal.update((ents) =>
      ents.map((e) =>
        e.id === id
          ? {
              ...e,
              markedAsProblem: false,
              problemDescription: undefined,
              problemSeverity: undefined,
              screenshot: undefined,
            }
          : e
      )
    );
  }

  exportProblems(): object {
    const problems = this.entriesSignal().filter((e) => e.markedAsProblem);
    return { problems, exportedAt: new Date().toISOString() };
  }

  async exportLogs(): Promise<void> {
    const blob = new Blob([JSON.stringify(this.entriesSignal(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dataflow-logs-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
