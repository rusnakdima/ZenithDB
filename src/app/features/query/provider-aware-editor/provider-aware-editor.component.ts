import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  ProviderDetectorService,
  QueryTranslationService,
  QueryValidatorService,
} from "../services";
import { SyntaxMode } from "../models";
import { logger } from "../../../services/logger.service";

@Component({
  selector: "app-provider-aware-editor",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./provider-aware-editor.component.html",
  /* // template: `
    <div class="flex h-full flex-col rounded-lg border border-slate-700 bg-slate-900">
      <!-- Mode Selector -->
      <div
        class="flex items-center justify-between border-b border-slate-700 bg-slate-800/50 px-4 py-2"
      >
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded px-3 py-1.5 text-xs transition-colors"
            [class.bg-[var(--accent)]]="syntaxMode() === 'sql'"
            [class.text-white]="syntaxMode() === 'sql'"
            [class.bg-slate-700]="syntaxMode() !== 'sql'"
            [class.text-slate-400]="syntaxMode() !== 'sql'"
            (click)="setSyntaxMode('sql')"
          >
            SQL
          </button>
          <button
            type="button"
            class="rounded px-3 py-1.5 text-xs transition-colors"
            [class.bg-[var(--accent)]]="syntaxMode() === 'mongodb'"
            [class.text-white]="syntaxMode() === 'mongodb'"
            [class.bg-slate-700]="syntaxMode() !== 'mongodb'"
            [class.text-slate-400]="syntaxMode() !== 'mongodb'"
            (click)="setSyntaxMode('mongodb')"
          >
            MongoDB
          </button>
          <button
            type="button"
            class="rounded px-3 py-1.5 text-xs transition-colors"
            [class.bg-[var(--accent)]]="syntaxMode() === 'json'"
            [class.text-white]="syntaxMode() === 'json'"
            [class.bg-slate-700]="syntaxMode() !== 'json'"
            [class.text-slate-400]="syntaxMode() !== 'json'"
            (click)="setSyntaxMode('json')"
          >
            JSON
          </button>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded px-2 py-1 text-xs text-[var(--accent)] transition-colors hover:bg-slate-700 hover:text-[var(--accent-hover)]"
            (click)="formatQuery()"
          >
            Format
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            (click)="clearQuery()"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Editor Area -->
      <div class="relative flex-1">
        <textarea
          #editorTextarea
          class="h-full w-full resize-none bg-slate-900 p-4 font-mono text-sm text-slate-200 focus:outline-none"
          [placeholder]="getPlaceholder()"
          [ngModel]="query()"
          (ngModelChange)="onQueryChange($event)"
          (keydown)="onKeydown($event)"
          (focus)="onFocus()"
          (blur)="onBlur()"
        ></textarea>

        <!-- Line Numbers -->
        <div
          class="pointer-events-none absolute top-0 bottom-0 left-0 w-12 overflow-hidden border-r border-slate-700 bg-slate-800/50"
        >
          <div class="pt-4">
            @for (line of lineNumbers(); track line) {
              <div class="pr-3 text-right font-mono text-xs leading-6 text-slate-600">
                {{ line }}
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Validation Status -->
      @if (validationResult()) {
        <div class="border-t border-slate-700 px-4 py-2">
          @if (!validationResult()!.isValid) {
            <div class="flex items-center gap-2 text-xs text-red-400">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{{ validationResult()!.errors[0]?.message }}</span>
            </div>
          } @else if (validationResult()!.warnings.length > 0) {
            <div class="flex items-center gap-2 text-xs text-amber-400">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>{{ validationResult()!.warnings.length }} warning(s)</span>
            </div>
          } @else {
            <div class="flex items-center gap-2 text-xs text-[var(--accent)]">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Valid query</span>
            </div>
          }
        </div>
      }
    </div>
  ` */
})
export class ProviderAwareEditorComponent implements OnInit, OnChanges {
  @ViewChild("editorTextarea") editorRef!: ElementRef<HTMLTextAreaElement>;

  private readonly providerDetector = inject(ProviderDetectorService);
  private readonly translationService = inject(QueryTranslationService);
  private readonly validator = inject(QueryValidatorService);
  

  @Input() initialQuery = "";
  @Input() collectionName = "";

  @Output() queryChange = new EventEmitter<string>();
  @Output() execute = new EventEmitter<void>();

  query = signal("");
  syntaxMode = this.providerDetector.currentSyntaxMode;
  validationResult = signal<{
    isValid: boolean;
    errors: { message: string }[];
    warnings: { message: string }[];
  } | null>(null);

  lineNumbers = computed(() => {
    const lines = this.query().split("\n").length;
    return Array.from({ length: lines }, (_, i) => i + 1);
  });

  ngOnInit(): void {
    if (this.initialQuery) {
      this.query.set(this.initialQuery);
      this.validateQuery();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["initialQuery"] && !changes["initialQuery"].firstChange) {
      this.query.set(this.initialQuery);
      this.validateQuery();
    }
  }

  setSyntaxMode(mode: SyntaxMode): void {
    logger.debug("[QUERY]", "Syntax mode changed", { mode });
    const currentQuery = this.query();
    const translated = this.translationService.translateToProvider(
      this.validator.parseQueryToFilter(currentQuery) ?? {},
      mode
    );

    if (translated.query && translated.query !== currentQuery) {
      this.query.set(translated.query);
      this.queryChange.emit(translated.query);
    }
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.queryChange.emit(value);
    this.validateQuery();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      this.onExecute();
    }

    if (event.ctrlKey && event.key === " ") {
      event.preventDefault();
      this.triggerAutocomplete();
    }
  }

  onFocus(): void {}
  onBlur(): void {}

  formatQuery(): void {
    const formatted = this.formatJson(this.query());
    if (formatted !== this.query()) {
      this.query.set(formatted);
      this.queryChange.emit(formatted);
    }
  }

  clearQuery(): void {
    this.query.set("");
    this.queryChange.emit("");
    this.validationResult.set(null);
  }

  private validateQuery(): void {
    if (!this.query().trim()) {
      this.validationResult.set(null);
      return;
    }

    const result = this.validator.validateQuery(this.query());
    this.validationResult.set(result);
  }

  private formatJson(jsonStr: string): string {
    try {
      const parsed = JSON.parse(jsonStr);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonStr;
    }
  }

  private triggerAutocomplete(): void {
    // Trigger autocomplete logic
  }

  private onExecute(): void {
    if (this.validationResult()?.isValid) {
      this.execute.emit();
    }
  }

  getPlaceholder(): string {
    switch (this.syntaxMode()) {
      case "sql":
        return "SELECT * FROM collection WHERE field = 'value'";
      case "mongodb":
        return '{ "field": { "$eq": "value" } }';
      case "json":
        return '{ "and": [ { "field": "value" } ] }';
      default:
        return "Enter your query...";
    }
  }
}
