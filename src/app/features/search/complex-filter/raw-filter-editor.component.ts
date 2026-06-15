import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { getLoggingService } from "@tauri-apps/logger";

@Component({
  selector: "app-raw-filter-editor",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./raw-filter-editor.component.html",
})
export class RawFilterEditorComponent implements OnInit {
  private logger = getLoggingService();

  @Input() initialJson = "";
  @Output() jsonChange = new EventEmitter<string>();
  @Output() jsonApply = new EventEmitter<string>();

  isValid = signal(true);
  validationError = signal("");

  protected jsonInput = signal("");

  ngOnInit(): void {
    this.jsonInput.set(this.initialJson);
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
      this.logger.debug("[SEARCH_FILTER]", "Raw filter JSON applied");
      this.jsonApply.emit(this.jsonInput());
    }
  }

  onToggleToVisual(): void {
    this.logger.debug("[SEARCH_FILTER]", "Toggled to visual filter editor");
    this.jsonChange.emit(this.jsonInput());
  }
}
