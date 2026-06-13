import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { isNullOrUndefined } from "@shared/utils/collection.utils";
import { LoggingService } from "@shared/services/logging.service";

@Component({
  selector: "app-cell-editor",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: "./cell-editor.component.html",
})
export class CellEditorComponent {
  private cdr = inject(ChangeDetectorRef);
  private logger = inject(LoggingService);
  @Input() value: unknown = null;
  @Input() isEditing = false;
  @Input() editValue = "";

  @Output() startEdit = new EventEmitter<void>();
  @Output() saveEdit = new EventEmitter<string>();
  @Output() cancelEdit = new EventEmitter<void>();

  get displayValue(): string {
    if (isNullOrUndefined(this.value)) return "null";
    if (typeof this.value === "object") return JSON.stringify(this.value);
    return String(this.value);
  }

  get isModified(): boolean {
    return this.isEditing;
  }

  onStart() {
    this.logger.debug("[DATA_GRID]", "Cell edit started");
    this.startEdit.emit();
  }

  onSave() {
    this.logger.debug("[DATA_GRID]", "Cell edit saved");
    this.saveEdit.emit(this.editValue);
  }

  onCancel() {
    this.logger.debug("[DATA_GRID]", "Cell edit cancelled");
    this.cancelEdit.emit();
  }
}
