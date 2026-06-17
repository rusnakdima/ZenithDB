import { Injectable, inject } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "../services/logger.service";

interface Response<T> {
  status: "success" | "error";
  data?: T;
  message?: string;
}

const DEFAULT_TIMEOUT_MS = 30000;

export interface InvokeOptions {
  timeoutMs?: number;
  suppressError?: boolean;
}

@Injectable({ providedIn: "root" })
export class TauriApiService {
  async invoke<T>(
    command: string,
    args?: Record<string, unknown>,
    options: InvokeOptions = {}
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    try {
      const response = await Promise.race([
        invoke<Response<T>>(command, args),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Command "${command}" timed out after ${timeoutMs}ms`)),
            timeoutMs
          )
        ),
      ]);
      if (response.status === "success") {
        return response.data as T;
      } else {
        throw new Error(response.message || `Operation failed: ${command}`);
      }
    } catch (error: unknown) {
      if (!options.suppressError) {
        logger.error(
          "[TAURI_API]",
          `Error invoking command "${command}" - TauriApi - ${JSON.stringify(error)}`
        );
      }
      throw error;
    }
  }

  async invokeRaw<T>(
    command: string,
    args?: Record<string, unknown>,
    options: InvokeOptions = {}
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    try {
      return await Promise.race([
        invoke<T>(command, args),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Command "${command}" timed out after ${timeoutMs}ms`)),
            timeoutMs
          )
        ),
      ]);
    } catch (error: unknown) {
      if (!options.suppressError) {
        logger.error(
          "[TAURI_API]",
          `Error invoking command "${command}" - TauriApi - ${JSON.stringify(error)}`
        );
      }
      throw error;
    }
  }
}
