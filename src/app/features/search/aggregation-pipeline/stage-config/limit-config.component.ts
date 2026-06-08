import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { SkipLimitConfig } from "../pipeline-builder.service";

@Component({
  selector: "app-limit-config",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-3">
      <div class="space-y-2">
        <label class="text-xs tracking-wide text-slate-400 uppercase">Value</label>
        <input
          type="number"
          class="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-200 focus:border-[var(--accent)] focus:outline-none"
          placeholder="Enter value..."
          [ngModel]="config.value"
          (ngModelChange)="onValueChange($event)"
          min="0"
        />
      </div>
    </div>
  `,
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
