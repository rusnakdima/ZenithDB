import { Injectable, signal } from "@angular/core";

@Injectable()
export class DataflowLoggerService {
  private readonly enabled = signal(false);

  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  log(): void {}
}
