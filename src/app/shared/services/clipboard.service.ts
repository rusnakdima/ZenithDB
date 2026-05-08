import { Injectable, inject } from "@angular/core";
import { ToastService } from "@services/toast.service";

@Injectable({ providedIn: "root" })
export class ClipboardService {
  private toast = inject(ToastService);

  async copyToClipboard(text: string, successMessage = "Copied to clipboard"): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success(successMessage);
      return true;
    } catch {
      this.toast.error("Failed to copy to clipboard");
      return false;
    }
  }
}