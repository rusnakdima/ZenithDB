import { Component, Input, Output, EventEmitter, signal, effect } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-raw-filter-editor",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./raw-filter-editor.component.html",
})
export class RawFilterEditorComponent {
  @Input() initialJson = "";
  @Output() jsonChange = new EventEmitter<string>();
  @Output() jsonApply = new EventEmitter<string>();

  isValid = signal(true);
  validationError = signal("");

  protected jsonInput = signal("");

  constructor() {
    effect(
      () => {
        this.jsonInput.set(this.initialJson);
      },
      { allowSignalWrites: true }
    );
  }

  onJsonInput(value: string): void {
    this.jsonInput.set(value);
    this.jsonChange.emit(value);
    this.validateJson(value);
  }

  private validateJson(json: string): void {
    if (!json.trim()) {
      this.isValid.set(true);
      this.validationError.set("");
      return;
    }

    try {
      JSON.parse(json);
      this.isValid.set(true);
      this.validationError.set("");
    } catch (e) {
      this.isValid.set(false);
      this.validationError.set((e as Error).message);
    }
  }

  onApply(): void {
    if (this.isValid()) {
      this.jsonApply.emit(this.jsonInput());
    }
  }

  onToggleToVisual(): void {
    this.jsonChange.emit(this.jsonInput());
  }
}
