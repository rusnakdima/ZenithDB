import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class DataflowLoggerService {
  log(message: string, data?: unknown): void {
    console.log(`[DATAFLOW] ${message}`, data ?? "");
  }
}
