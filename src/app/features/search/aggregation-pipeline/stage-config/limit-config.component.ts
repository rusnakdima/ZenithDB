import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { SkipLimitConfig } from "../pipeline-builder.service";

@Component({
  selector: "app-limit-config",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./limit-config.component.html",
})
export class LimitConfigComponent {
  @Input() config!: SkipLimitConfig;
  @Output() configChange = new EventEmitter<SkipLimitConfig>();

  onValueChange(value: number): void {
    this.configChange.emit({
      ...this.config,
      value: Math.max(0, value || 0),
    });
  }
}
