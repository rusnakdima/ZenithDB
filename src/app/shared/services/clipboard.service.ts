import { Injectable, inject } from "@angular/core";
import { ToastService } from "@services/toast.service";
import { logger } from "@core/services/logger.service";

@Injectable({ providedIn: "root" })
export class ClipboardService {
  private toast = inject(ToastService);

  async copyToClipboard(text: string, successMessage = "Copied to clipboard"): Promise<boolean> {
    logger.debug("[CLIPBOARD]", "copyToClipboard started", { textLength: text.length });
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success(successMessage);
      logger.debug("[CLIPBOARD]", "copyToClipboard completed", { success: true });
      return true;
    } catch {
      this.toast.error("Failed to copy to clipboard");
      logger.error("[CLIPBOARD]", "copyToClipboard failed");
      return false;
    }
  }
}
