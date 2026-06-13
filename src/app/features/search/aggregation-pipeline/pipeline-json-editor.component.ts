import { Component, Input, Output, EventEmitter, signal, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { LoggingService } from "@shared/services/logging.service";

@Component({
  selector: "app-pipeline-json-editor",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./pipeline-json-editor.component.html",
  /* // template: `
    <div class="flex h-full flex-col rounded-lg border border-slate-700 bg-slate-900">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <h3 class="text-sm font-medium text-slate-200">JSON Editor</h3>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            (click)="formatJson()"
          >
            Format
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            (click)="copyToClipboard()"
          >
            Copy
          </button>
        </div>
      </div>

      <!-- Editor -->
      <div class="flex-1 p-4">
        <textarea
          class="h-full w-full rounded border border-slate-600 bg-slate-800 p-3 font-mono text-sm text-slate-200 focus:border-[var(--accent)] focus:outline-none"
          [ngModel]="jsonContent()"
          (ngModelChange)="onJsonChange($event)"
          placeholder="Enter aggregation pipeline JSON..."
          spellcheck="false"
        ></textarea>
      </div>

      <!-- Error Display -->
      @if (error()) {
        <div class="border-t border-red-900/50 bg-red-900/20 px-4 py-2">
          <div class="flex items-center gap-2 text-xs text-red-400">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {{ error() }}
          </div>
        </div>
      }

      <!-- Footer -->
      <div class="flex items-center justify-between border-t border-slate-700 px-4 py-2">
        <span class="text-xs text-slate-500">
          @if (isValid()) {
            <span class="text-[var(--accent)]">Valid JSON</span>
          } @else if (jsonContent() && !error()) {
            <span class="text-amber-400">Empty or invalid</span>
          }
        </span>
        <span class="text-xs text-slate-500">{{ lineCount() }} lines</span>
      </div>
    </div>
  ` */
})
export class PipelineJsonEditorComponent {
  private logger = inject(LoggingService);

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
      this.logger.debug("[SEARCH_PIPELINE]", "JSON formatted");
      this.jsonContent.set(formatted);
      this.jsonChange.emit(formatted);
    } catch {}
  }

  copyToClipboard(): void {
    this.logger.debug("[SEARCH_PIPELINE]", "Pipeline JSON copied to clipboard");
    navigator.clipboard
      .writeText(this.jsonContent())
      .then(() => {})
      .catch(() => {});
  }
}
