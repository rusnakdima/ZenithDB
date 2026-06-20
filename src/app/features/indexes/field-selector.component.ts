import { Component, Input, Output, EventEmitter, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FieldInfo } from "@features/query/models";
import { IndexField } from "./index.service";
import { IndexType } from "./create-index-dialog.component";
@Component({
  selector: "app-field-selector",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./field-selector.component.html",
})
export class FieldSelectorComponent {
  @Input() availableFields: FieldInfo[] = [];
  @Input() indexType: IndexType = "single";
  @Output() fieldsChange = new EventEmitter<IndexField[]>();
  selectedFields = signal<IndexField[]>([]);
  onFieldToggle(field: FieldInfo): void {
    const current = this.selectedFields();
    const existing = current.find((f) => f.name === field.name);
    if (existing) {
      this.selectedFields.update((fields) => fields.filter((f) => f.name !== field.name));
    } else {
      this.selectedFields.update((fields) => [
        ...fields,
        { name: field.name, direction: "asc" as const },
      ]);
    }
    this.emitChange();
  }
  onDirectionChange(fieldName: string, direction: "asc" | "desc"): void {
    this.selectedFields.update((fields) =>
      fields.map((f) => (f.name === fieldName ? { ...f, direction } : f))
    );
    this.emitChange();
  }
  onWeightChange(fieldName: string, weight: number): void {
    this.selectedFields.update((fields) =>
      fields.map((f) => (f.name === fieldName ? { ...f, weight } : f))
    );
    this.emitChange();
  }
  onRemoveField(fieldName: string): void {
    this.selectedFields.update((fields) => fields.filter((f) => f.name !== fieldName));
    this.emitChange();
  }
  isFieldSelected(fieldName: string): boolean {
    return this.selectedFields().some((f) => f.name === fieldName);
  }
  getFieldDirection(fieldName: string): "asc" | "desc" {
    return this.selectedFields().find((f) => f.name === fieldName)?.direction ?? "asc";
  }
  getFieldWeight(fieldName: string): number {
    return this.selectedFields().find((f) => f.name === fieldName)?.weight ?? 1;
  }
  private emitChange(): void {
    this.fieldsChange.emit(this.selectedFields());
  }
  trackByField(index: number, field: FieldInfo): string {
    return field.name || String(index);
  }
  trackBySelected(index: number, field: IndexField): string {
    return field.name || String(index);
  }
}
