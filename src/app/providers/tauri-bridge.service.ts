import { Injectable, inject } from "@angular/core";
import { invoke, InvokeOptions } from "@tauri-apps/api/core";
import { SettingsService } from "@shared/services/settings.service";

export interface InvokeResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

@Injectable({ providedIn: "root" })
export class TauriBridgeService {
  private settingsService = inject(SettingsService);

  getConnectionTimeoutMs(): number {
    return this.settingsService.currentSettings.connections.connectionTimeout * 1000;
  }

  async invoke<T>(cmd: string, args?: Record<string, unknown>, options?: InvokeOptions): Promise<T> {
    return invoke<T>(cmd, args, options);
  }
}
