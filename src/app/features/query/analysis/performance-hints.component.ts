import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { QueryAnalyzerService, QueryAnalysisResult } from "./query-analyzer.service";
import { QueryHint, IndexRecommendation } from "../services/hint-analyzer.service";
import { FilterExpression } from "@shared/models/connection.config";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { logger } from "../../../services/logger.service";

@Component({
  selector: "app-performance-hints",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: "./performance-hints.component.html",
})
export class PerformanceHintsComponent implements OnInit, OnChanges {
  private cdr = inject(ChangeDetectorRef);
  private readonly queryAnalyzer = inject(QueryAnalyzerService);
  private readonly errorHandler = inject(ErrorHandlerService);
  

  @Input() collectionName = "";
  @Input() filterText = "";

  @Output() createIndex = new EventEmitter<{ collection: string; field: string }>();
  @Output() actionClick = new EventEmitter<{ hint: QueryHint; execute: () => void }>();

  hints = signal<QueryHint[]>([]);
  recommendations = signal<IndexRecommendation[]>([]);
  score = signal(100);
  isLoading = signal(false);

  ngOnInit(): void {
    this.analyze();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["filterText"] || changes["collectionName"]) {
      this.analyze();
    }
  }

  private async analyze(): Promise<void> {
    if (!this.collectionName || !this.filterText) {
      this.hints.set([]);
      this.recommendations.set([]);
      return;
    }

    this.isLoading.set(true);
    logger.debug("[QUERY]", "Starting performance analysis", {
      collectionName: this.collectionName,
    });

    try {
      let filter: FilterExpression;
      try {
        filter = JSON.parse(this.filterText);
      } catch {
        this.hints.set([]);
        this.recommendations.set([]);
        this.isLoading.set(false);
        return;
      }

      const result: QueryAnalysisResult = await this.queryAnalyzer.analyzeQueryFull(
        filter,
        this.collectionName
      );

      this.hints.set(result.hints);
      this.recommendations.set(result.recommendations);
      this.score.set(result.score);
      logger.debug("[QUERY]", "Performance analysis complete", {
        score: result.score,
        hintCount: result.hints.length,
      });
    } catch (e) {
      this.errorHandler.handleError(e, "PerformanceHintsComponent.analyze");
      this.hints.set([]);
      this.recommendations.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  getHintIcon(type: "info" | "warning" | "error"): string {
    switch (type) {
      case "error":
        return "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
      case "warning":
        return "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
      default:
        return "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
    }
  }

  getHintColor(type: "info" | "warning" | "error"): string {
    switch (type) {
      case "error":
        return "text-red-400 border border-[var(--accent)]/30";
      case "warning":
        return "text-amber-400 border border-[var(--accent)]/30";
      default:
        return "text-blue-400 border border-[var(--accent)]/30";
    }
  }

  getHintButtonColor(type: "info" | "warning" | "error"): string {
    return "bg-[var(--accent)] hover:bg-[var(--accent-hover)]";
  }

  onHintAction(hint: QueryHint): void {
    if (hint.action) {
      hint.action.execute();
      this.actionClick.emit({ hint, execute: hint.action.execute });
    }
  }

  onCreateIndex(field: string): void {
    this.createIndex.emit({ collection: this.collectionName, field });
  }

  getScoreColor(): string {
    const s = this.score();
    if (s >= 80) return "text-emerald-400";
    if (s >= 50) return "text-amber-400";
    return "text-red-400";
  }

  getScoreBgColor(): string {
    return "border border-[var(--accent)]/30";
  }

  refresh(collectionName: string, filterText: string): void {
    this.collectionName = collectionName;
    this.filterText = filterText;
    this.analyze();
  }
}
