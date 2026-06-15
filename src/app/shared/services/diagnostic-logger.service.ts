import { Injectable, inject } from "@angular/core";
import { LoggerService } from "@core/services/logger.service";

@Injectable({ providedIn: "root" })
export class DiagnosticLoggerService {
  private logger = inject(LoggerService);

  debug(message: string, context?: string, data?: any): void {
    this.logger.debug(message, context, data);
  }

  info(message: string, context?: string, data?: any): void {
    this.logger.info(message, context, data);
  }

  warn(message: string, context?: string, data?: any): void {
    this.logger.warn(message, context, data);
  }

  error(message: string, context?: string, data?: any): void {
    this.logger.error(message, context, data);
  }

  log(message: string, data?: any): void {
    this.logger.info(message, "Diagnostic", data);
  }
}
