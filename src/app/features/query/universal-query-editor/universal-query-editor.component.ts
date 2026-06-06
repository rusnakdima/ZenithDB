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
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { DataStoreService } from "@services/core/data-store.service";
import { ToastService } from "@services/toast.service";
import { PersistentStorageService } from "@shared/services/persistent-storage.service";
import { ExportService } from "@shared/services/export.service";
import { TabService } from "@shared/services/tab.service";
import { QueryExecutionService } from "@shared/services/query-execution.service";
import { QueryResult } from "@shared/models/connection.config";
import { formatSQL } from "@shared/utils";
import { QueryTab } from "@shared/models/query.model";
import { FilterExpression } from "@shared/models/connection.config";

import {
  ProviderDetectorService,
  QueryTranslationService,
  QueryValidatorService,
  FilterBuilderService,
  TemplateService,
  HintAnalyzerService,
} from "../services";

import { VisualQueryBuilderComponent } from "../visual-query-builder/visual-query-builder.component";
import { QueryTemplatesComponent } from "../query-templates/query-templates.component";
import { QueryHintsComponent } from "../hints/query-hints.component";
import { ProviderAwareEditorComponent } from "../provider-aware-editor/provider-aware-editor.component";
import { SortConfig } from "../models";

type EditorMode = "text" | "visual";
type PanelType = "templates" | "history" | "none";

@Component({
  selector: "app-universal-query-editor",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    VisualQueryBuilderComponent,
    QueryTemplatesComponent,
    QueryHintsComponent,
    ProviderAwareEditorComponent,
  ],
  template: `
    <div class="flex h-full flex-col bg-slate-900">
      <!-- Toolbar -->
      <div
        class="flex items-center justify-between border-b border-slate-700 bg-slate-800/50 px-4 py-2"
      >
        <div class="flex items-center gap-2">
          <!-- Editor Mode Toggle -->
          <div class="flex items-center gap-1 rounded bg-slate-700 p-0.5">
            <button
              type="button"
              class="rounded px-3 py-1.5 text-xs transition-colors"
              [class.bg-emerald-600]="editorMode() === 'text'"
              [class.text-white]="editorMode() === 'text'"
              [class.text-slate-400]="editorMode() !== 'text'"
              (click)="editorMode.set('text')"
            >
              Text
            </button>
            <button
              type="button"
              class="rounded px-3 py-1.5 text-xs transition-colors"
              [class.bg-emerald-600]="editorMode() === 'visual'"
              [class.text-white]="editorMode() === 'visual'"
              [class.text-slate-400]="editorMode() !== 'visual'"
              (click)="editorMode.set('visual')"
            >
              Visual
            </button>
          </div>

          <!-- Templates Button -->
          <button
            type="button"
            class="flex items-center gap-2 rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            (click)="togglePanel('templates')"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
              />
            </svg>
            Templates
          </button>
        </div>

        <div class="flex items-center gap-2">
          <!-- History Toggle -->
          <button
            type="button"
            class="flex items-center gap-2 rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            (click)="togglePanel('history')"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            History
          </button>

          <!-- Execute Button -->
          <button
            type="button"
            class="flex items-center gap-2 rounded bg-emerald-600 px-4 py-1.5 text-xs text-white transition-colors hover:bg-emerald-500"
            (click)="executeQuery()"
            [disabled]="isLoading()"
          >
            @if (isLoading()) {
              <svg
                class="h-4 w-4 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-8m15.357 8H15"
                />
              </svg>
              Executing...
            } @else {
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.65z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Run
            }
          </button>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="flex flex-1 overflow-hidden">
        <!-- Left Panel (Templates or History) -->
        @if (activePanel() !== "none") {
          <div class="w-80 overflow-hidden border-r border-slate-700">
            @if (activePanel() === "templates") {
              <app-query-templates
                (selectTemplate)="onSelectTemplate($event)"
                (close)="activePanel.set('none')"
              />
            } @else if (activePanel() === "history") {
              <div class="flex h-full flex-col bg-slate-900">
                <div class="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                  <h3 class="text-sm font-medium text-slate-200">Query History</h3>
                  <button
                    type="button"
                    class="p-1 text-slate-400 hover:text-white"
                    (click)="activePanel.set('none')"
                  >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div class="flex-1 overflow-y-auto p-4">
                  @for (item of history(); track item.id) {
                    <div
                      class="mb-3 cursor-pointer rounded-lg border border-slate-700 bg-slate-800 p-3 transition-colors hover:border-emerald-500/50"
                      (click)="loadFromHistory(item)"
                    >
                      <div class="mb-1 text-xs text-slate-400">
                        {{ item.timestamp | date: "short" }}
                      </div>
                      <div class="truncate font-mono text-sm text-slate-300">
                        {{ item.query }}
                      </div>
                      @if (!item.success) {
                        <div class="mt-1 text-xs text-red-400">Failed</div>
                      }
                    </div>
                  } @empty {
                    <div class="py-8 text-center">
                      <p class="text-sm text-slate-500">No query history</p>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- Main Editor Area -->
        <div class="flex flex-1 flex-col overflow-hidden">
          @if (editorMode() === "text") {
            <app-provider-aware-editor
              [initialQuery]="query()"
              [collectionName]="collectionName"
              (queryChange)="query.set($event)"
              (execute)="executeQuery()"
            />
          } @else {
            <app-visual-query-builder
              [collectionName]="collectionName"
              [initialFilter]="visualFilter()"
              [initialSort]="visualSort()"
              [initialSkip]="visualSkip()"
              [initialLimit]="visualLimit()"
              (filterChange)="onVisualFilterChange($event)"
              (sortChange)="onVisualSortChange($event)"
              (paginationChange)="onVisualPaginationChange($event)"
              (apply)="onVisualApply($event)"
              (cancel)="editorMode.set('text')"
            />
          }
        </div>
      </div>

      <!-- Hints Area -->
      <app-query-hints [collectionName]="collectionName" [filterText]="query()" />

      <!-- Status Bar -->
      <div
        class="flex items-center justify-between border-t border-slate-700 bg-slate-800/50 px-4 py-2 text-xs"
      >
        <div class="flex items-center gap-4">
          <span class="text-slate-400">
            Collection: <span class="text-emerald-400">{{ collectionName || "None" }}</span>
          </span>
          @if (executionTime()) {
            <span class="text-slate-400">
              Execution: <span class="text-slate-300">{{ executionTime() }}ms</span>
            </span>
          }
        </div>

        <div class="flex items-center gap-2">
          <span class="text-slate-500">Ctrl+Enter to execute</span>
        </div>
      </div>
    </div>
  `,
})
export class UniversalQueryEditorComponent implements OnInit, OnChanges {
  private readonly connectionState = inject(ConnectionStateService);
  private readonly dataStore = inject(DataStoreService);
  private readonly toast = inject(ToastService);
  private readonly storage = inject(PersistentStorageService);
  private readonly exportService = inject(ExportService);
  private readonly tabService = inject(TabService);
  private readonly queryExecution = inject(QueryExecutionService);

  private readonly providerDetector = inject(ProviderDetectorService);
  private readonly translationService = inject(QueryTranslationService);
  private readonly validator = inject(QueryValidatorService);
  private readonly filterBuilder = inject(FilterBuilderService);
  private readonly templateService = inject(TemplateService);
  private readonly hintAnalyzer = inject(HintAnalyzerService);

  @Input() collectionName = "";
  @Input() activeTab: QueryTab | null = null;

  @Output() queryExecuted = new EventEmitter<void>();

  editorMode = signal<EditorMode>("text");
  activePanel = signal<PanelType>("none");
  query = signal("");
  visualFilter = signal<FilterExpression | null>(null);
  visualSort = signal<SortConfig[]>([]);
  visualSkip = signal<number | null>(null);
  visualLimit = signal<number | null>(null);
  isLoading = signal(false);
  executionTime = signal<number | null>(null);
  history = signal<{ id: string; query: string; timestamp: Date; success: boolean }[]>([]);

  ngOnInit(): void {
    this.loadHistory();
    this.updateProviderFromConnection();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["activeTab"] && this.activeTab) {
      this.query.set(this.activeTab.query);
    }
  }

  private loadHistory(): void {
    const stored = this.storage.get<any[]>("zenith_query_history");
    if (stored) {
      this.history.set(
        stored.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        }))
      );
    }
  }

  private saveHistory(): void {
    const limited = this.history().slice(0, 20);
    this.storage.set(
      "zenith_query_history",
      limited.map((h) => ({ ...h, timestamp: h.timestamp.toISOString() }))
    );
  }

  private updateProviderFromConnection(): void {
    const conn = this.connectionState.activeConnection();
    if (conn) {
      this.providerDetector.updateFromConnection(conn);
    }
  }

  togglePanel(panel: PanelType): void {
    this.activePanel.update((current) => (current === panel ? "none" : panel));
  }

  onSelectTemplate(template: any): void {
    this.activePanel.set("none");

    const variables: Record<string, unknown> = {};
    for (const v of template.variables) {
      variables[v.name] = v.defaultValue;
    }

    const result = this.templateService.applyTemplate(template, variables);

    if (result.filter.conditions.length > 0 || result.filter.groups?.length) {
      this.visualFilter.set(result.filter as FilterExpression);
      this.visualSort.set(result.sort ?? []);
      this.visualLimit.set(result.limit ?? null);
      this.editorMode.set("visual");
    } else {
      const translated = this.translationService.translateToProvider(
        result.filter as FilterExpression
      );
      this.query.set(translated.query);
      this.editorMode.set("text");
    }
  }

  loadFromHistory(item: { query: string }): void {
    this.query.set(item.query);
    this.activePanel.set("none");
  }

  onVisualFilterChange(filter: FilterExpression): void {
    this.visualFilter.set(filter);
  }

  onVisualSortChange(sort: SortConfig[]): void {
    this.visualSort.set(sort);
  }

  onVisualPaginationChange(pagination: { skip: number | null; limit: number | null }): void {
    this.visualSkip.set(pagination.skip);
    this.visualLimit.set(pagination.limit);
  }

  onVisualApply(result: {
    filter: FilterExpression | null;
    sort: SortConfig[];
    skip: number | null;
    limit: number | null;
  }): void {
    this.visualFilter.set(result.filter);
    this.visualSort.set(result.sort);
    this.visualSkip.set(result.skip);
    this.visualLimit.set(result.limit);

    const translated = this.translationService.translateToProvider(result.filter ?? {});
    this.query.set(translated.query);

    this.editorMode.set("text");
  }

  async executeQuery(): Promise<void> {
    const currentQuery = this.query();
    if (!currentQuery.trim()) return;

    this.isLoading.set(true);
    const startTime = performance.now();

    try {
      const result = await this.queryExecution.executeWithTiming(currentQuery);
      this.executionTime.set(performance.now() - startTime);

      if (result.success) {
        this.addToHistory(currentQuery, true);
      } else {
        this.addToHistory(currentQuery, false, result.error);
      }

      this.queryExecuted.emit();
    } catch (e) {
      this.toast.error((e as Error).message);
      this.addToHistory(currentQuery, false, (e as Error).message);
    } finally {
      this.isLoading.set(false);
    }
  }

  private addToHistory(query: string, success: boolean, errorMsg?: string): void {
    const item = {
      id: crypto.randomUUID(),
      query,
      timestamp: new Date(),
      success,
    };

    const newHistory = [item, ...this.history().filter((h) => h.query !== query)].slice(0, 20);

    this.history.set(newHistory);
    this.saveHistory();
  }
}
