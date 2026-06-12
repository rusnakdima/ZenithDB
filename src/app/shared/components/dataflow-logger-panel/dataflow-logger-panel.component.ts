import { Component, inject, signal, computed, HostListener } from "@angular/core";
import { DatePipe } from "@angular/common";
import {
  DataflowLoggerService,
  DataFlowEntry,
  DataFlowDirection,
  ProblemSeverity,
} from "@shared/services/dataflow-logger.service";

type FilterDirection = "all" | DataFlowDirection;

@Component({
  selector: "app-dataflow-logger-panel",
  standalone: true,
  imports: [DatePipe],
  templateUrl: "./dataflow-logger-panel.component.html",
})
export class DataflowLoggerPanelComponent {
  logger = inject(DataflowLoggerService);

  isOpen = signal(false);
  filterDirection = signal<FilterDirection>("all");
  filterPage = signal("");
  filterOperation = signal("");
  showProblemsOnly = signal(false);
  selectedEntryForProblem = signal<DataFlowEntry | null>(null);
  problemDescription = signal("");
  problemSeverity = signal<ProblemSeverity>("medium");

  filteredEntries = computed(() => {
    let entries = this.logger.entries();
    const dir = this.filterDirection();
    if (dir !== "all") {
      entries = entries.filter((e) => e.direction === dir);
    }
    if (this.showProblemsOnly()) {
      entries = entries.filter((e) => e.markedAsProblem);
    }
    const page = this.filterPage().toLowerCase();
    if (page) {
      entries = entries.filter((e) => e.page.toLowerCase().includes(page));
    }
    const op = this.filterOperation().toLowerCase();
    if (op) {
      entries = entries.filter((e) => e.operation.toLowerCase().includes(op));
    }
    return entries;
  });

  uniquePages = computed(() => {
    const pages = new Set(this.logger.entries().map((e) => e.page));
    return Array.from(pages).sort();
  });

  uniqueOperations = computed(() => {
    const ops = new Set(this.logger.entries().map((e) => e.operation));
    return Array.from(ops).sort();
  });

  @HostListener("document:keydown", ["$event"])
  handleKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "L") {
      event.preventDefault();
      this.toggle();
    }
  }

  toggle(): void {
    this.isOpen.update((v) => !v);
  }

  close(): void {
    this.isOpen.set(false);
  }

  clearLogs(): void {
    this.logger.clear();
  }

  setFilterDirection(dir: FilterDirection): void {
    this.filterDirection.set(dir);
  }

  setFilterPage(page: string): void {
    this.filterPage.set(page);
  }

  setFilterOperation(op: string): void {
    this.filterOperation.set(op);
  }

  toggleProblemsOnly(): void {
    this.showProblemsOnly.update((v) => !v);
  }

  openProblemDialog(entry: DataFlowEntry): void {
    this.selectedEntryForProblem.set(entry);
    this.problemDescription.set(entry.problemDescription || "");
    this.problemSeverity.set(entry.problemSeverity || "medium");
  }

  closeProblemDialog(): void {
    this.selectedEntryForProblem.set(null);
    this.problemDescription.set("");
    this.problemSeverity.set("medium");
  }

  async markAsProblem(): Promise<void> {
    const entry = this.selectedEntryForProblem();
    if (!entry) return;
    const screenshot = await this.logger.captureScreenshot();
    this.logger.markAsProblem(
      entry.id,
      this.problemDescription(),
      this.problemSeverity(),
      screenshot
    );
    this.closeProblemDialog();
  }

  unmarkProblem(entry: DataFlowEntry): void {
    this.logger.unmarkAsProblem(entry.id);
  }

  async exportProblems(): Promise<void> {
    const report = this.logger.exportProblems();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `problems-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async exportAllLogs(): Promise<void> {
    await this.logger.exportLogs();
  }

  getDirectionClass(entry: DataFlowEntry): string {
    switch (entry.direction) {
      case "in":
        return "text-[var(--color-success)]";
      case "out":
        return "text-[var(--accent)]";
      case "user_action":
        return "text-[var(--color-warning)]";
      default:
        return "text-[var(--text-main)]";
    }
  }

  getDirectionIcon(entry: DataFlowEntry): string {
    switch (entry.direction) {
      case "in":
        return "↓";
      case "out":
        return "↑";
      case "user_action":
        return "•";
      default:
        return "?";
    }
  }

  getSeverityColor(severity: ProblemSeverity | undefined): string {
    switch (severity) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  }

  trackById(index: number, entry: DataFlowEntry): string {
    return entry.id;
  }
}
