import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  ChangeDetectionStrategy,
  computed,
} from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { AuditService } from "./audit.service";

@Component({
  selector: "app-change-detail",
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./change-detail.component.html",
})
export class ChangeDetailComponent {
  private auditService = inject(AuditService);

  @Input() before: Record<string, unknown> | undefined;
  @Input() after: Record<string, unknown> | undefined;
  @Output() close = new EventEmitter<void>();

  diffs = computed(() => {
    return this.auditService.computeDiff(this.before, this.after);
  });

  onClose(): void {
    this.close.emit();
  }

  formatValue(value: unknown): string {
    if (value == null) return "null";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  }
}
