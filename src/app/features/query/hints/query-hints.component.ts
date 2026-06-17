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
import { logger } from "../../../services/logger.service";

@Component({
  selector: "app-query-hints",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./query-hints.component.html",
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
      logger.debug("[QUERY]", "Loading query hints", { collectionName: this.collectionName });
      const parsed = JSON.parse(this.filterText);
      const hints = await this.hintAnalyzer.analyzeQuery(parsed, this.collectionName);
      this.hints.set(hints);
      logger.debug("[QUERY]", "Query hints loaded", { hintCount: hints.length });
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
