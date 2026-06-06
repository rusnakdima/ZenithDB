import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { HintAnalyzerService, QueryHint } from "../services";

@Component({
  selector: "app-query-hints",
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (hints().length > 0) {
      <div class="border-t border-slate-700 bg-slate-800/50">
        <!-- Header -->
        <button
          type="button"
          class="flex w-full items-center justify-between px-4 py-2 text-xs text-slate-400 transition-colors hover:text-slate-300"
          (click)="toggleExpanded()"
        >
          <div class="flex items-center gap-2">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{{ hints().length }} hint(s)</span>
          </div>

          <svg
            class="h-4 w-4 transition-transform"
            [class.rotate-180]="isExpanded()"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <!-- Content -->
        @if (isExpanded()) {
          <div class="space-y-2 px-4 pb-3">
            @for (hint of hints(); track hint.message) {
              <div
                class="flex items-start gap-3 rounded p-2 text-sm"
                [class.bg-amber-500/10]="hint.type === 'warning'"
                [class.border-amber-500/30]="hint.type === 'warning'"
                [class.text-amber-300]="hint.type === 'warning'"
                [class.bg-emerald-500/10]="hint.type === 'info'"
                [class.border-emerald-500/30]="hint.type === 'info'"
                [class.text-emerald-300]="hint.type === 'info'"
                [class.bg-red-500/10]="hint.type === 'error'"
                [class.border-red-500/30]="hint.type === 'error'"
                [class.text-red-300]="hint.type === 'error'"
                [class.border]="hint.type !== 'info'"
              >
                <div class="flex-1">
                  @if (hint.code) {
                    <span class="mr-2 font-mono text-xs opacity-60">[{{ hint.code }}]</span>
                  }
                  <span>{{ hint.message }}</span>
                </div>

                @if (hint.action) {
                  <button
                    type="button"
                    class="rounded px-2 py-1 text-xs transition-colors"
                    [class.bg-amber-600]="hint.type === 'warning'"
                    [class.hover:bg-amber-500]="hint.type === 'warning'"
                    [class.bg-emerald-600]="hint.type === 'info'"
                    [class.hover:bg-emerald-500]="hint.type === 'info'"
                    [class.text-white]="hint.type !== 'error'"
                    (click)="onAction(hint)"
                  >
                    {{ hint.action.label }}
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class QueryHintsComponent implements OnInit {
  private readonly hintAnalyzer = inject(HintAnalyzerService);

  @Input() collectionName = "";
  @Input() filterText = "";

  @Output() actionClick = new EventEmitter<{ hint: QueryHint; execute: () => void }>();

  hints = signal<QueryHint[]>([]);
  isExpanded = signal(true);

  ngOnInit(): void {
    this.loadHints();
  }

  private async loadHints(): Promise<void> {
    if (!this.collectionName || !this.filterText) {
      this.hints.set([]);
      return;
    }

    try {
      const parsed = JSON.parse(this.filterText);
      const hints = await this.hintAnalyzer.analyzeQuery(parsed, this.collectionName);
      this.hints.set(hints);
    } catch {
      this.hints.set([]);
    }
  }

  toggleExpanded(): void {
    this.isExpanded.update((v) => !v);
  }

  onAction(hint: QueryHint): void {
    if (hint.action) {
      hint.action.execute();
      this.actionClick.emit({ hint, execute: hint.action.execute });
    }
  }

  refresh(collectionName: string, filterText: string): void {
    this.collectionName = collectionName;
    this.filterText = filterText;
    this.loadHints();
  }
}
