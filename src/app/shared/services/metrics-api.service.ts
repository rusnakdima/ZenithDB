import { Injectable, inject, signal } from "@angular/core";
import { CacheService } from "@shared/services/cache.service";
import { TauriBridgeService } from "@providers/tauri-bridge.service";
import { logger } from "../../services/logger.service";
import { SystemMetrics } from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class MetricsApiService extends CacheService {
  private tauriBridge = inject(TauriBridgeService);
  
  private metricsSignal = signal<SystemMetrics | null>(null);
  private metricsTimestamp = signal<number>(0);
  private refreshCallbacks: Set<() => void> = new Set();
  private readonly METRICS_TTL_MS = 10 * 1000;

  getMetrics(): SystemMetrics | null {
    return this.metricsSignal();
  }

  async fetchMetrics(): Promise<SystemMetrics> {
    logger.debug("[METRICS_API]", "fetchMetrics started");
    const cached = this.metricsSignal();
    const timestamp = this.metricsTimestamp();
    if (cached && !this.isStale(timestamp, this.METRICS_TTL_MS)) {
      return cached;
    }
    return this.fetchMetricsInternal();
  }

  async fetchMetricsWithRefresh(): Promise<SystemMetrics> {
    logger.debug("[METRICS_API]", "fetchMetricsWithRefresh started");
    const result = await this.fetchMetricsInternal();
    this.notifyRefresh();
    return result;
  }

  onMetricsRefreshed(callback: () => void): () => void {
    this.refreshCallbacks.add(callback);
    return () => this.refreshCallbacks.delete(callback);
  }

  invalidateMetrics(): void {
    logger.debug("[METRICS_API]", "invalidateMetrics called");
    this.metricsSignal.set(null);
    this.metricsTimestamp.set(0);
  }

  private getMetricsTimestamp(): number {
    return this.metricsTimestamp();
  }

  private async fetchMetricsInternal(): Promise<SystemMetrics> {
    logger.debug("[METRICS_API]", "fetchMetricsInternal started");
    const fetchFn = async (): Promise<SystemMetrics> => {
      const metrics = await this.tauriBridge.invoke<SystemMetrics>("get_system_status", {});
      this.metricsSignal.set(metrics);
      this.metricsTimestamp.set(Date.now());
      return metrics;
    };
    return this.getOrFetch("system_metrics", fetchFn, this.METRICS_TTL_MS).then((result) => {
      logger.debug("[METRICS_API]", "fetchMetricsInternal completed");
      return result;
    });
  }

  private notifyRefresh(): void {
    this.refreshCallbacks.forEach((cb) => cb());
  }
}
