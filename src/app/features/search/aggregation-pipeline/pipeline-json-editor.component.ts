import { Component, Input, Output, EventEmitter, signal, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
@Component({
  selector: "app-pipeline-json-editor",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./pipeline-json-editor.component.html",
})
export class PipelineJsonEditorComponent {
  @Input() set json(value: string) {
    this.jsonContent.set(value);
  }

  @Output() jsonChange = new EventEmitter<string>();
  @Output() parseError = new EventEmitter<string | null>();

  jsonContent = signal("");
  error = signal<string | null>(null);
  isValid = signal(false);
  lineCount = computed(() => this.jsonContent().split("\n").length);

  onJsonChange(value: string): void {
    this.jsonContent.set(value);
    this.validateJson(value);
    this.jsonChange.emit(value);
  }

  private validateJson(value: string): void {
    if (!value.trim()) {
      this.error.set(null);
      this.isValid.set(false);
      this.parseError.emit(null);
      return;
    }

    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        this.error.set("Pipeline must be an array");
        this.isValid.set(false);
        this.parseError.emit("Pipeline must be an array");
        return;
      }
      this.error.set(null);
      this.isValid.set(true);
      this.parseError.emit(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Invalid JSON";
      this.error.set(`Invalid JSON: ${message}`);
      this.isValid.set(false);
      this.parseError.emit(this.error());
    }
  }

  formatJson(): void {
    try {
      const parsed = JSON.parse(this.jsonContent());
      const formatted = JSON.stringify(parsed, null, 2);
      this.jsonContent.set(formatted);
      this.jsonChange.emit(formatted);
    } catch {}
  }

  copyToClipboard(): void {
    navigator.clipboard
      .writeText(this.jsonContent())
      .then(() => {})
      .catch(() => {});
  }
}
