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
  ChangeDetectionStrategy,
  ChangeDetectorRef,
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
import { QueryTemplate } from "../models/query-template.model";

import {
  ProviderDetectorService,
  QueryTranslationService,
  QueryValidatorService,
  FilterBuilderService,
  TemplateService,
  HintAnalyzerService,
} from "../services";
import { getLoggingService } from "@tauri-apps/logger";

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    VisualQueryBuilderComponent,
    QueryTemplatesComponent,
    QueryHintsComponent,
    ProviderAwareEditorComponent,
  ],
  templateUrl: "./universal-query-editor.component.html",
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
  private readonly logger = getLoggingService();
  private readonly cdr = inject(ChangeDetectorRef);

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
    this.logger.debug("[QUERY]", "Universal query editor initialized");
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["activeTab"] && this.activeTab) {
      this.query.set(this.activeTab.query);
    }
  }

  private loadHistory(): void {
    interface HistoryItem {
      id: string;
      query: string;
      timestamp: string | Date;
      collection?: string;
      success?: boolean;
    }
    const stored = this.storage.get<HistoryItem[]>("zenith_query_history");
    if (stored) {
      this.history.set(
        stored.map((h) => ({
          ...h,
          timestamp: new Date(h.timestamp),
          success: h.success ?? false,
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

  onSelectTemplate(template: QueryTemplate): void {
    this.logger.debug("[QUERY_TEMPLATE]", "Applying template in editor", {
      id: template.id,
      name: template.name,
    });
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

    this.logger.debug("[QUERY]", "Executing query", { queryLength: currentQuery.length });
    this.isLoading.set(true);
    const startTime = performance.now();

    try {
      const result = await this.queryExecution.executeWithTiming(currentQuery);
      this.executionTime.set(performance.now() - startTime);

      if (result.success) {
        this.logger.debug("[QUERY]", "Query execution successful", {
          executionTime: this.executionTime(),
        });
        this.addToHistory(currentQuery, true);
      } else {
        this.logger.debug("[QUERY]", "Query execution failed", { error: result.error });
        this.addToHistory(currentQuery, false, result.error);
      }

      this.queryExecuted.emit();
    } catch (e) {
      this.logger.error("[QUERY]", "Query execution error", { error: (e as Error).message });
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
