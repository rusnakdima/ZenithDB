import { Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class DiagnosticLoggerService {
  log(message: string, data?: unknown): void {
    console.log(`[DIAGNOSTIC] ${message}`, data ?? "");
  }
}
