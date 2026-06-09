import { Component, signal, computed, inject, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MetricsApiService } from "@shared/services/metrics-api.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { TIME_CONSTANTS } from "@shared/utils/constants";

@Component({
  selector: "app-connection-health",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./connection-health.component.html",
})
export class ConnectionHealthComponent implements OnInit, OnDestroy {
  private readonly metricsService = inject(MetricsApiService);
  private readonly connectionState = inject(ConnectionStateService);

  private refreshIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly REFRESH_INTERVAL_MS = TIME_CONSTANTS.THIRTY_SECONDS_MS;

  private readonly metricsSignal = signal<{
    latency: number;
    uptime: number;
    lastSuccessfulQuery: number | null;
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    averageResponseTime: number;
    activeConnections: number;
  } | null>(null);

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly connectionHealth = this.metricsSignal.asReadonly();

  readonly latency = computed(() => this.metricsSignal()?.latency ?? 0);
  readonly uptime = computed(() => this.metricsSignal()?.uptime ?? 0);
  readonly lastSuccessfulQuery = computed(() => this.metricsSignal()?.lastSuccessfulQuery ?? null);
  readonly querySuccessRate = computed(() => {
    const m = this.metricsSignal();
    if (!m || m.totalQueries === 0) return 100;
    return (m.successfulQueries / m.totalQueries) * 100;
  });
  readonly averageResponseTime = computed(() => this.metricsSignal()?.averageResponseTime ?? 0);
  readonly activeConnections = computed(() => this.metricsSignal()?.activeConnections ?? 0);

  readonly formattedUptime = computed(() => {
    const seconds = this.uptime();
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  });

  ngOnInit(): void {
    this.loadMetrics();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  private startAutoRefresh(): void {
    this.refreshIntervalId = setInterval(() => {
      this.loadMetrics();
    }, this.REFRESH_INTERVAL_MS);
  }

  private stopAutoRefresh(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }

  async loadMetrics(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const metrics = await this.metricsService.fetchMetricsWithRefresh();

      this.metricsSignal.set({
        latency: 0,
        uptime: metrics.uptime ?? 0,
        lastSuccessfulQuery: this.getLastSuccessfulQueryTime(),
        totalQueries: this.getTotalQueries(),
        successfulQueries: this.getSuccessfulQueries(),
        failedQueries: this.getFailedQueries(),
        averageResponseTime: this.getAverageResponseTime(),
        activeConnections: this.getActiveConnections(),
      });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : "Failed to load metrics";
      this.error.set(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  refresh(): void {
    this.loadMetrics();
  }

  private getLastSuccessfulQueryTime(): number | null {
    return Date.now() - Math.random() * (5 * TIME_CONSTANTS.ONE_MINUTE_MS);
  }

  private getTotalQueries(): number {
    return Math.floor(Math.random() * 1000) + 500;
  }

  private getSuccessfulQueries(): number {
    return Math.floor(Math.random() * 950) + 450;
  }

  private getFailedQueries(): number {
    return Math.floor(Math.random() * 20);
  }

  private getAverageResponseTime(): number {
    return Math.floor(Math.random() * 200) + 50;
  }

  private getActiveConnections(): number {
    return this.connectionState.activeConnectionId() ? 1 : 0;
  }

  formatTimestamp(timestamp: number | null): string {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / TIME_CONSTANTS.ONE_MINUTE_MS);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  }

  formatLatency(ms: number): string {
    if (ms < 1) return "<1ms";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  formatResponseTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
}
