import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  OnDestroy,
  inject,
} from "@angular/core";
import { JsonPipe, DatePipe } from "@angular/common";
import { RawResult } from "@app/models/connection.config";
import { trackByIndex } from "@shared/utils/collection.utils";
import { logger } from "@core/services/logger.service";

type LogLevel = "all" | "info" | "warn" | "error";
type TabType = "results" | "messages" | "plan";

interface LogEntry {
  timestamp: Date;
  level: "info" | "warn" | "error";
  message: string;
}

@Component({
  selector: "app-output-console",
  standalone: true,
  imports: [JsonPipe, DatePipe],
  templateUrl: "./output-console.component.html",
})
export class OutputConsoleComponent implements OnDestroy {
  @Input() results: RawResult | null = null;
  @Input() loading = false;
  @Input() error = "";
  @Input() executionTime = 0;
  @Input() set resultsHeight(value: number) {
    this._height.set(value);
  }
  @Output() clear = new EventEmitter<void>();

  activeTab = signal<TabType>("results");
  filterLevel = signal<LogLevel>("all");
  autoScroll = signal(true);
  isResizing = false;

  private boundOnMove: ((e: MouseEvent) => void) | null = null;
  private boundOnUp: (() => void) | null = null;

  private _height = signal(300);
  get height() {
    return this._height();
  }

  logs = signal<LogEntry[]>([]);

  filteredLogs = computed(() => {
    const level = this.filterLevel();
    if (level === "all") return this.logs();
    return this.logs().filter((l) => l.level === level);
  });

  rowCount = computed(() => this.results?.rows?.length ?? 0);

  setActiveTab(tab: TabType) {
    this.activeTab.set(tab);
    logger.debug("[OUTPUT_CONSOLE]", "Active tab changed", { tab });
  }

  setFilterLevel(level: LogLevel) {
    this.filterLevel.set(level);
    logger.debug("[OUTPUT_CONSOLE]", "Filter level changed", { level });
  }

  toggleAutoScroll() {
    this.autoScroll.set(!this.autoScroll());
    logger.debug("[OUTPUT_CONSOLE]", "Auto-scroll toggled", { autoScroll: this.autoScroll() });
  }

  clearMessages() {
    this.logs.set([]);
    logger.debug("[OUTPUT_CONSOLE]", "Messages cleared");
  }

  addLog(level: "info" | "warn" | "error", message: string) {
    this.logs.update((logs) => [...logs, { timestamp: new Date(), level, message }]);
  }

  startResize(event: MouseEvent) {
    this.isResizing = true;
    const startY = event.clientY;
    const startHeight = this._height();

    const onMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeight + delta));
      this._height.set(newHeight);
    };

    const onUp = () => {
      this.isResizing = false;
      document.removeEventListener("mousemove", this.boundOnMove!);
      document.removeEventListener("mouseup", this.boundOnUp!);
    };

    this.boundOnMove = onMove;
    this.boundOnUp = onUp;

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  getTabs(): { id: TabType; label: string }[] {
    return [
      { id: "results", label: "Results" },
      { id: "messages", label: "Messages" },
      { id: "plan", label: "Execution Plan" },
    ];
  }

  getFilterLevels(): LogLevel[] {
    return ["all", "info", "warn", "error"];
  }

  trackByIndex = trackByIndex;

  ngOnDestroy() {
    this.isResizing = false;
    if (this.boundOnMove) {
      document.removeEventListener("mousemove", this.boundOnMove);
      this.boundOnMove = null;
    }
    if (this.boundOnUp) {
      document.removeEventListener("mouseup", this.boundOnUp);
      this.boundOnUp = null;
    }
  }
}
