import { Injectable, inject } from "@angular/core";
import { ToastService } from "@services/toast.service";
import { getLoggingService } from "@tauri-apps/logger";

@Injectable({ providedIn: "root" })
export class ClipboardService {
  private toast = inject(ToastService);
  private logger = getLoggingService();

  async copyToClipboard(text: string, successMessage = "Copied to clipboard"): Promise<boolean> {
    this.logger.debug("[CLIPBOARD]", "copyToClipboard started", { textLength: text.length });
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success(successMessage);
      this.logger.debug("[CLIPBOARD]", "copyToClipboard completed", { success: true });
      return true;
    } catch {
      this.toast.error("Failed to copy to clipboard");
      this.logger.error("[CLIPBOARD]", "copyToClipboard failed");
      return false;
    }
  }
}
