import { Component, inject, signal, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PerformanceService, PerformanceMetrics } from "./performance.service";
import { TIME_CONSTANTS } from "@shared/utils/constants";
import { MetricsChartComponent } from "./metrics-chart.component";

type TimeRange = "1h" | "6h" | "24h" | "7d";

@Component({
  selector: "app-performance-dashboard",
  standalone: true,
  imports: [CommonModule, FormsModule, MetricsChartComponent],
  templateUrl: "./performance-dashboard.component.html",
})
export class PerformanceDashboardComponent implements OnInit, OnDestroy {
  private performanceService = inject(PerformanceService);

  metrics = signal<PerformanceMetrics | null>(null);
  selectedTimeRange = signal<TimeRange>("1h");
  isLoading = signal(false);

  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  timeRanges: { value: TimeRange; label: string }[] = [
    { value: "1h", label: "1 Hour" },
    { value: "6h", label: "6 Hours" },
    { value: "24h", label: "24 Hours" },
    { value: "7d", label: "7 Days" },
  ];

  ngOnInit(): void {
    this.loadMetrics();
    this.refreshInterval = setInterval(() => this.loadMetrics(), TIME_CONSTANTS.THIRTY_SECONDS_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  onTimeRangeChange(range: TimeRange): void {
    this.selectedTimeRange.set(range);
    this.performanceService.setTimeRange(range);
    this.loadMetrics();
  }

  private async loadMetrics(): Promise<void> {
    this.isLoading.set(true);
    try {
      this.metrics.set(this.performanceService.metrics());
    } finally {
      this.isLoading.set(false);
    }
  }

  formatExecutionTime(ms: number): string {
    if (ms < 1) return "< 1ms";
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  formatQps(qps: number): string {
    if (qps < 1) return qps.toFixed(2);
    if (qps < 10) return qps.toFixed(1);
    return qps.toFixed(0);
  }
}
