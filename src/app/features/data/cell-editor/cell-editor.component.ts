import { Component, Input, Output, EventEmitter, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-cell-editor",
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (isEditing) {
      <input
        [(ngModel)]="editValue"
        (keyup.enter)="onSave()"
        (keyup.escape)="onCancel()"
        (blur)="onSave()"
        class="mono w-full rounded-lg border border-[var(--accent)]/50 bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--accent)] focus:border-[var(--accent)] focus:outline-none"
        [value]="editValue"
        autofocus
      />
    } @else {
      <div
        class="-mx-1 cursor-pointer rounded-lg px-2 py-1.5 text-[var(--text-main)] transition-colors hover:bg-[var(--bg-elevated)]"
        [class.text-[var(--accent)]="isModified"
        (dblclick)="onStart()"
      >
        {{ displayValue }}
      </div>
    }
  `,
})
export class CellEditorComponent {
  @Input() value: unknown = null;
  @Input() isEditing = false;
  @Input() editValue = "";

  @Output() startEdit = new EventEmitter<void>();
  @Output() saveEdit = new EventEmitter<string>();
  @Output() cancelEdit = new EventEmitter<void>();

  get displayValue(): string {
    if (this.value === null || this.value === undefined) return "null";
    if (typeof this.value === "object") return JSON.stringify(this.value);
    return String(this.value);
  }

  get isModified(): boolean {
    return this.isEditing;
  }

  onStart() {
    this.startEdit.emit();
  }

  onSave() {
    this.saveEdit.emit(this.editValue);
  }

  onCancel() {
    this.cancelEdit.emit();
  }
}