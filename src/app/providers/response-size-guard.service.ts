import { Injectable, inject } from "@angular/core";
import { ToastService } from "@services/toast.service";
import { AppLoggerService } from "@shared/services/app-logger.service";

@Injectable({ providedIn: "root" })
export class ResponseSizeGuardService {
  private readonly MAX_RESPONSE_SIZE_MB = 10;
  private readonly MAX_RESPONSE_SIZE_BYTES = this.MAX_RESPONSE_SIZE_MB * 1024 * 1024;
  private logger = inject(AppLoggerService);

  checkResponseSize(data: unknown): { truncated: boolean; message?: string } {
    try {
      const jsonStr = JSON.stringify(data);
      const sizeBytes = new Blob([jsonStr]).size;
      if (sizeBytes > this.MAX_RESPONSE_SIZE_BYTES) {
        const message = `Response size (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB) exceeds ${this.MAX_RESPONSE_SIZE_MB}MB limit. Data may be truncated.`;
        this.logger.warn("[SIZE_GUARD]", "Response size exceeded limit", {
          sizeBytes,
          maxBytes: this.MAX_RESPONSE_SIZE_BYTES,
        });
        return {
          truncated: true,
          message,
        };
      }
    } catch {
      return { truncated: false };
    }
    return { truncated: false };
  }

  getMaxItems(): number {
    return Math.floor(this.MAX_RESPONSE_SIZE_BYTES / 500);
  }

  getMaxSizeBytes(): number {
    return this.MAX_RESPONSE_SIZE_BYTES;
  }
}
