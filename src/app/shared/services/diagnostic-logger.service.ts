import { Injectable } from "@angular/core";

export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  scrollableHeight: number;
  scrollPercent: number;
  timestamp: number;
  label?: string;
}

export interface LayoutMetrics {
  scrollHeight: number;
  clientHeight: number;
  offsetHeight: number;
  offsetWidth: number;
  scrollWidth: number;
  overflowY: string | null;
  overflowX: string | null;
  position: string | null;
  timestamp: number;
}

export interface DataLoadMetrics {
  label: string;
  count: number;
  durationMs: number;
  timestamp: number;
}

export interface DiagLogEntry {
  type: "scroll" | "layout" | "data" | "event" | "mark" | "wheel";
  label: string;
  timestamp: number;
  data: ScrollMetrics | LayoutMetrics | DataLoadMetrics | Record<string, unknown>;
}

@Injectable({ providedIn: "root" })
export class DiagnosticLoggerService {
  private enabled = false;
  private scrollTrackerCleanup: (() => void) | null = null;
  private wheelTrackerCleanup: (() => void) | null = null;
  private rafId: number | null = null;
  private scrollBuffer: ScrollMetrics[] = [];
  private readonly BUFFER_SIZE = 50;
  private readonly FLUSH_INTERVAL = 2000;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private wheelCount = 0;
  private wheelRafId: number | null = null;

  constructor() {
    this.initGlobalToggle();
    // DISABLED: No automatic log flushing
    // this.startFlushTimer();
  }

  private initGlobalToggle(): void {
    Object.defineProperty(window, "__zenithdb_diag", {
      get: () => this.enabled,
      set: (val: boolean) => {
        this.enabled = val;
        this.logMsg("DiagService", "Diagnostic logging " + (val ? "ENABLED" : "DISABLED"));
      },
      configurable: true,
    });
    if (typeof window !== "undefined") {
      (window as any).__zenithdb_diag = false;
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushScrollBuffer();
    }, this.FLUSH_INTERVAL);
  }

  private getTimestamp(): number {
    return Date.now();
  }

  private logMsg(prefix: string, data: unknown): void {
    if (this.enabled) {
      console.log(`[ZenithDB-Diag] [${new Date().toISOString()}] ${prefix}`, data);
    }
  }

  private flushScrollBuffer(): void {
    if (this.scrollBuffer.length === 0) return;
    const entries = this.scrollBuffer.splice(0, this.scrollBuffer.length);
    const grouped = this.groupScrollMetrics(entries);
    for (const [label, metrics] of Object.entries(grouped)) {
      this.logMsg(
        `[Scroll:${label}] Count=${metrics.count} AvgScrollTop=${metrics.avgScrollTop.toFixed(1)} AvgScrollPercent=${metrics.avgScrollPercent.toFixed(1)}% MaxScrollTop=${metrics.maxScrollTop}`,
        metrics
      );
    }
  }

  private groupScrollMetrics(entries: ScrollMetrics[]): Record<
    string,
    {
      count: number;
      avgScrollTop: number;
      avgScrollPercent: number;
      maxScrollTop: number;
      samples: ScrollMetrics[];
    }
  > {
    const groups: Record<string, any> = {};
    for (const m of entries) {
      const label = m.label || "main";
      if (!groups[label]) {
        groups[label] = {
          count: 0,
          avgScrollTop: 0,
          avgScrollPercent: 0,
          maxScrollTop: 0,
          samples: [],
        };
      }
      const g = groups[label];
      g.count++;
      g.avgScrollTop = (g.avgScrollTop * (g.count - 1) + m.scrollTop) / g.count;
      g.avgScrollPercent = (g.avgScrollPercent * (g.count - 1) + m.scrollPercent) / g.count;
      g.maxScrollTop = Math.max(g.maxScrollTop, m.scrollTop);
      g.samples.push(m);
    }
    return groups;
  }

  enable(): void {
    this.enabled = true;
    this.logMsg("DiagService", "Diagnostic logging ENABLED (window.__zenithdb_diag = true)");
  }

  disable(): void {
    this.enabled = false;
    this.scrollTrackerCleanup?.();
    this.scrollTrackerCleanup = null;
    this.wheelTrackerCleanup?.();
    this.wheelTrackerCleanup = null;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.wheelRafId !== null) {
      cancelAnimationFrame(this.wheelRafId);
      this.wheelRafId = null;
    }
    this.logMsg("DiagService", "Diagnostic logging DISABLED");
  }

  mark(label: string, data?: Record<string, unknown>): void {
    if (!this.enabled) return;
    const entry: DiagLogEntry = {
      type: "mark",
      label,
      timestamp: this.getTimestamp(),
      data: data || {},
    };
    this.logMsg(`[Mark: ${label}]`, entry);
  }

  logDataLoad(
    label: string,
    count: number,
    durationMs: number,
    extra?: Record<string, unknown>
  ): void {
    if (!this.enabled) return;
    const metrics: DataLoadMetrics = {
      label,
      count,
      durationMs,
      timestamp: this.getTimestamp(),
    };
    const entry: DiagLogEntry = {
      type: "data",
      label,
      timestamp: metrics.timestamp,
      data: extra ? { ...metrics, ...extra } : metrics,
    };
    this.logMsg(`[DataLoad: ${label}] items=${count} duration=${durationMs}ms`, entry);
  }

  logLayout(element: HTMLElement | null, label: string, extra?: Record<string, unknown>): void {
    if (!this.enabled || !element) return;
    const style = window.getComputedStyle(element);
    const metrics: LayoutMetrics = {
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      offsetHeight: element.offsetHeight,
      offsetWidth: element.offsetWidth,
      scrollWidth: element.scrollWidth,
      overflowY: style.overflowY,
      overflowX: style.overflowX,
      position: style.position,
      timestamp: this.getTimestamp(),
    };
    const entry: DiagLogEntry = {
      type: "layout",
      label,
      timestamp: metrics.timestamp,
      data: extra ? { ...metrics, ...extra } : metrics,
    };
    this.logMsg(
      `[Layout: ${label}] scrollH=${metrics.scrollHeight} clientH=${metrics.clientHeight} offsetH=${metrics.offsetHeight} overflowY=${metrics.overflowY} position=${metrics.position}`,
      entry
    );
  }

  logScrollImmediate(
    scrollTop: number,
    scrollHeight: number,
    clientHeight: number,
    label: string
  ): void {
    if (!this.enabled) return;
    const scrollableHeight = scrollHeight - clientHeight;
    const scrollPercent = scrollableHeight > 0 ? (scrollTop / scrollableHeight) * 100 : 0;
    const metrics: ScrollMetrics = {
      scrollTop,
      scrollHeight,
      clientHeight,
      scrollableHeight,
      scrollPercent,
      timestamp: this.getTimestamp(),
    };
    (metrics as any).label = label;
    this.scrollBuffer.push(metrics);
    if (this.scrollBuffer.length >= this.BUFFER_SIZE) {
      this.flushScrollBuffer();
    }
  }

  startScrollTracking(element: HTMLElement | null, label: string = "main"): () => void {
    if (!this.enabled || !element) return () => {};

    let lastScrollTop = -1;
    let scrollCount = 0;

    const handler = () => {
      if (this.rafId !== null) return;
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        const scrollTop = element.scrollTop;
        const scrollHeight = element.scrollHeight;
        const clientHeight = element.clientHeight;
        scrollCount++;
        if (scrollTop !== lastScrollTop) {
          lastScrollTop = scrollTop;
          this.logScrollImmediate(scrollTop, scrollHeight, clientHeight, label);
        }
      });
    };

    element.addEventListener("scroll", handler, { passive: true });
    this.logMsg(`[ScrollTrack: ${label}] STARTED`, {
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    });

    this.scrollTrackerCleanup = () => {
      element.removeEventListener("scroll", handler);
      this.flushScrollBuffer();
      this.logMsg(`[ScrollTrack: ${label}] STOPPED (events=${scrollCount})`, {});
    };

    return this.scrollTrackerCleanup;
  }

  stopScrollTracking(): void {
    this.scrollTrackerCleanup?.();
    this.scrollTrackerCleanup = null;
  }

  logEvent(label: string, data: Record<string, unknown>): void {
    if (!this.enabled) return;
    const entry: DiagLogEntry = {
      type: "event",
      label,
      timestamp: this.getTimestamp(),
      data,
    };
    this.logMsg(`[Event: ${label}]`, entry);
  }

  startWheelTracking(element: HTMLElement | null, label: string = "main"): () => void {
    if (!this.enabled || !element) return () => {};

    const handler = (e: WheelEvent) => {
      if (this.wheelRafId !== null) return;
      this.wheelRafId = requestAnimationFrame(() => {
        this.wheelRafId = null;
        this.wheelCount++;
        const entry: DiagLogEntry = {
          type: "wheel",
          label,
          timestamp: this.getTimestamp(),
          data: {
            deltaX: e.deltaX,
            deltaY: e.deltaY,
            deltaZ: e.deltaZ,
            deltaMode: e.deltaMode,
            scrollTop: element.scrollTop,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
          },
        };
        this.logMsg(
          `[Wheel:${label}] dY=${e.deltaY.toFixed(1)} scrollTop=${element.scrollTop}`,
          entry
        );
      });
    };

    element.addEventListener("wheel", handler, { passive: true });
    this.logMsg(`[WheelTrack: ${label}] STARTED`, {});

    this.wheelTrackerCleanup = () => {
      element.removeEventListener("wheel", handler);
      this.logMsg(`[WheelTrack: ${label}] STOPPED (wheelEvents=${this.wheelCount})`, {});
      this.wheelCount = 0;
    };

    return this.wheelTrackerCleanup;
  }

  stopWheelTracking(): void {
    this.wheelTrackerCleanup?.();
    this.wheelTrackerCleanup = null;
  }
}
