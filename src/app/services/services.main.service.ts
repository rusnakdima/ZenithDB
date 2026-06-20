import { Injectable, inject } from "@angular/core";
import { TauriBridgeService } from "@providers/providers.tauri-bridge.service";
@Injectable({ providedIn: "root" })
export class MainService {
  private tauriBridge = inject(TauriBridgeService);
  async initialize(): Promise<void> {
    await this.tauriBridge.invoke("initialize_app");
  }
  async getVersion(): Promise<string> {
    return this.tauriBridge.invoke<string>("get_version");
  }
  async isConnected(): Promise<boolean> {
    return this.tauriBridge.invoke<boolean>("is_connected");
  }
}
