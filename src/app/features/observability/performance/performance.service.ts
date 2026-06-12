import { Injectable, inject, signal, computed } from "@angular/core";
import { MetricsApiService } from "@shared/services/metrics-api.service";
import { TIME_CONSTANTS } from "@shared/utils/constants";
import { AppLoggerService } from "@shared/services/app-logger.service";

export interface QueryMetric {
  timestamp: number;
  query: string;
  executionTime: number;
  success: boolean;
  error?: string;
}

export interface PerformanceMetrics {
  qps: number;
  avgExecutionTime: number;
  slowQueryCount: number;
  memoryUsage: number;
  queriesOverTime: { timestamp: number; value: number }[];
  latencyOverTime: { timestamp: number; value: number }[];
  errorRateOverTime: { timestamp: number; value: number }[];
}

type TimeRange = "1h" | "6h" | "24h" | "7d";

@Injectable({ providedIn: "root" })
export class PerformanceService {
  private metricsApi = inject(MetricsApiService);
  private logger = inject(AppLoggerService);

  private queryMetrics = signal<QueryMetric[]>([]);
  private timeRangeSignal = signal<TimeRange>("1h");
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  readonly timeRange = this.timeRangeSignal.asReadonly();

  readonly metrics = computed<PerformanceMetrics>(() => {
    const metrics = this.queryMetrics();
    const now = Date.now();
    const rangeMs = this.getRangeMs(this.timeRangeSignal());
    const cutoff = now - rangeMs;

    const recentMetrics = metrics.filter((m) => m.timestamp >= cutoff);

    const totalQueries = recentMetrics.length;
    const successfulQueries = recentMetrics.filter((m) => m.success).length;
    const failedQueries = recentMetrics.filter((m) => !m.success).length;

    const qps = totalQueries / (rangeMs / 1000);

    const executionTimes = recentMetrics.map((m) => m.executionTime);
    const avgExecutionTime =
      executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
        : 0;

    const slowQueryCount = recentMetrics.filter((m) => m.executionTime > 1000).length;

    const memoryUsage = 0;

    const queriesOverTime = this.aggregateByTimeBucket(
      recentMetrics,
      TIME_CONSTANTS.ONE_MINUTE_MS,
      (m) => m.timestamp,
      () => 1
    );
    const latencyOverTime = this.aggregateByTimeBucket(
      recentMetrics,
      TIME_CONSTANTS.ONE_MINUTE_MS,
      (m) => m.timestamp,
      (m) => m.executionTime
    );
    const errorRateOverTime = this.aggregateByTimeBucket(
      recentMetrics,
      TIME_CONSTANTS.ONE_MINUTE_MS,
      (m) => m.timestamp,
      (m) => (m.success ? 0 : 1)
    );

    return {
      qps,
      avgExecutionTime,
      slowQueryCount,
      memoryUsage,
      queriesOverTime,
      latencyOverTime,
      errorRateOverTime,
    };
  });

  constructor() {
    this.startAutoRefresh();
  }

  setTimeRange(range: TimeRange): void {
    this.logger.debug("[PERFORMANCE]", "Time range changed", { range });
    this.timeRangeSignal.set(range);
  }

  recordQuery(metric: Omit<QueryMetric, "timestamp">): void {
    this.queryMetrics.update((metrics) => {
      const newMetric: QueryMetric = {
        ...metric,
        timestamp: Date.now(),
      };
      const updated = [...metrics, newMetric];
      const cutoff = Date.now() - this.getRangeMs("7d");
      return updated.filter((m) => m.timestamp >= cutoff);
    });
    this.logger.debug("[PERFORMANCE]", "Query recorded", {
      query: metric.query,
      executionTime: metric.executionTime,
    });
  }

  clearMetrics(): void {
    this.logger.info("[PERFORMANCE]", "Clearing metrics");
    this.queryMetrics.set([]);
  }

  private getRangeMs(range: TimeRange): number {
    switch (range) {
      case "1h":
        return TIME_CONSTANTS.ONE_HOUR_MS;
      case "6h":
        return TIME_CONSTANTS.ONE_HOUR_MS * 6;
      case "24h":
        return TIME_CONSTANTS.TWENTY_FOUR_HOURS_MS;
      case "7d":
        return TIME_CONSTANTS.TWENTY_FOUR_HOURS_MS * 7;
    }
  }

  private aggregateByTimeBucket<T>(
    metrics: QueryMetric[],
    bucketMs: number,
    getTimestamp: (m: QueryMetric) => number,
    getValue: (m: QueryMetric) => T
  ): { timestamp: number; value: T }[] {
    const buckets = new Map<number, T[]>();

    for (const metric of metrics) {
      const timestamp = getTimestamp(metric);
      const bucketKey = Math.floor(timestamp / bucketMs) * bucketMs;
      const value = getValue(metric);

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(value);
    }

    const result: { timestamp: number; value: T }[] = [];
    buckets.forEach((values, timestamp) => {
      let aggregatedValue: T;
      if (typeof values[0] === "number") {
        const numValues = values as number[];
        aggregatedValue = (numValues.reduce((a, b) => a + b, 0) / numValues.length) as T;
      } else {
        aggregatedValue = values[0];
      }
      result.push({ timestamp, value: aggregatedValue });
    });

    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  private startAutoRefresh(): void {
    this.refreshInterval = setInterval(() => {
      this.queryMetrics.update((metrics) => {
        const cutoff = Date.now() - this.getRangeMs("7d");
        return metrics.filter((m) => m.timestamp >= cutoff);
      });
    }, TIME_CONSTANTS.THIRTY_SECONDS_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}
