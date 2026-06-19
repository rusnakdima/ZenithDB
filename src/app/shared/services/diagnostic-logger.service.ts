import { Injectable } from "@angular/core";

@Injectable()
export class DiagnosticLoggerService {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  log(): void {}
}
