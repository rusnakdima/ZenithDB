import { Component, Input, Output, EventEmitter, signal, computed, OnDestroy } from "@angular/core";
import { JsonPipe, DatePipe } from "@angular/common";
import { RawResult } from "@shared/models/connection.config";

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

  private _height = signal(300);
  get height() {
    return this._height();
  }

  logs = signal<LogEntry[]>([
    { timestamp: new Date(), level: "info", message: "Ready to execute queries" },
  ]);

  filteredLogs = computed(() => {
    const level = this.filterLevel();
    if (level === "all") return this.logs();
    return this.logs().filter((l) => l.level === level);
  });

  rowCount = computed(() => this.results?.rows?.length ?? 0);

  setActiveTab(tab: TabType) {
    this.activeTab.set(tab);
  }

  setFilterLevel(level: LogLevel) {
    this.filterLevel.set(level);
  }

  toggleAutoScroll() {
    this.autoScroll.set(!this.autoScroll());
  }

  clearMessages() {
    this.logs.set([]);
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
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

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

  trackByIndex(index: number) {
    return index;
  }

  ngOnDestroy() {
    this.isResizing = false;
  }
}
