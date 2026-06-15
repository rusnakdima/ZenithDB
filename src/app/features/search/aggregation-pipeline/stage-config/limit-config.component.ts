import { Component, Input, Output, EventEmitter, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { SkipLimitConfig } from "../pipeline-builder.service";
import { getLoggingService } from "@tauri-apps/logger";

@Component({
  selector: "app-limit-config",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./limit-config.component.html",
})
export class LimitConfigComponent {
  private logger = getLoggingService();

  @Input() config!: SkipLimitConfig;
  @Output() configChange = new EventEmitter<SkipLimitConfig>();

  onValueChange(value: number): void {
    this.logger.debug("[SEARCH_PIPELINE]", "Skip/limit value changed", { value });
    this.configChange.emit({
      ...this.config,
      value: Math.max(0, value || 0),
    });
  }
}
