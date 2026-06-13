import { Injectable, inject } from "@angular/core";
import { invoke, InvokeOptions as TauriInvokeOptions } from "@tauri-apps/api/core";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { SettingsService } from "@shared/services/settings.service";
import { LoggingService } from "@shared/services/logging.service";

const DEFAULT_TIMEOUT_MS = 30000;

export interface InvokeOptions {
  timeoutMs?: number;
  suppressError?: boolean;
  signal?: AbortSignal;
}

export class ApiException extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = "ApiException";
  }
}

interface ResponseModel {
  status: "success" | "error" | "info" | "warning";
  message: string;
  data: unknown;
}

@Injectable({ providedIn: "root" })
export class TauriBridgeService {
  private errorHandler = inject(ErrorHandlerService);
  private settingsService = inject(SettingsService);
  private logger = inject(LoggingService);

  getConnectionTimeoutMs(): number {
    return this.settingsService.currentSettings.connections.connectionTimeout * 1000;
  }

  private getDefaultTimeoutMs(): number {
    return this.settingsService.currentSettings.connections.connectionTimeout * 1000;
  }

  async invoke<T>(
    command: string,
    args?: Record<string, unknown>,
    options: InvokeOptions = {}
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? this.getDefaultTimeoutMs();
    const { signal, suppressError } = options;

    this.logger.debug("[TAURI_BRIDGE]", "Invoking command", { command, args });

    try {
      const tauriOptions = signal ? { signal: signal as unknown as AbortSignal } : {};
      const response = await Promise.race([
        invoke<ResponseModel>(command, args, tauriOptions as TauriInvokeOptions),
        new Promise<never>((_, reject) => {
          const timeoutId = window.setTimeout(() => {
            this.logger.warn("[TAURI_BRIDGE]", "Command timed out", { command, timeoutMs });
            reject(new Error(`Command "${command}" timed out after ${timeoutMs}ms`));
          }, timeoutMs);
          if (signal) {
            signal.addEventListener(
              "abort",
              () => {
                clearTimeout(timeoutId);
              },
              { once: true }
            );
          }
        }),
      ]);

      if (response.status === "success") {
        this.logger.debug("[TAURI_BRIDGE]", "Command succeeded", { command });
        return response.data as T;
      }

      this.logger.error("[TAURI_BRIDGE]", "Command failed", { command, message: response.message });
      throw new ApiException(response.message || `Operation failed: ${command}`, command);
    } catch (error: unknown) {
      this.logger.error("[TAURI_BRIDGE]", "Invoke failed", { command, error });
      if (!suppressError) {
        const appError = this.errorHandler.handleError(error, `TauriBridgeService.${command}`);
        if (error instanceof ApiException) {
          throw error;
        }
        throw new ApiException(
          error instanceof Error ? error.message : String(error),
          command,
          error
        );
      }
      if (error instanceof ApiException) {
        throw error;
      }
      throw new ApiException(
        error instanceof Error ? error.message : String(error),
        command,
        error
      );
    }
  }
}
