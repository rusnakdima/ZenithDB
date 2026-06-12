import {
  Component,
  input,
  signal,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  OnChanges,
  SimpleChanges,
  inject,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { AppLoggerService } from "@shared/services/app-logger.service";

export interface ChartDataPoint {
  timestamp: number;
  value: number;
}

type ChartType = "line" | "bar" | "area";

@Component({
  selector: "app-metrics-chart",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./metrics-chart.component.html",
})
export class MetricsChartComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild("chartCanvas") canvasRef!: ElementRef<HTMLCanvasElement>;

  data = input<ChartDataPoint[]>([]);
  type = input<ChartType>("line");
  label = input<string>("");
  color = input<string>("rgb(59, 130, 246)");

  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrame: number | null = null;
  private logger = inject(AppLoggerService);

  ngAfterViewInit(): void {
    this.initCanvas();
    this.drawChart();
    this.logger.debug("[MetricsChart]", "Chart rendered", {
      type: this.type(),
      label: this.label(),
      dataPoints: this.data().length,
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["data"] && !changes["data"].firstChange) {
      this.drawChart();
      this.logger.debug("[MetricsChart]", "Chart data updated", { dataPoints: this.data().length });
    }
    if (changes["data"] && changes["data"].currentValue !== changes["data"].previousValue) {
      const prevTimeRange = this.getTimeRange(changes["data"]?.previousValue);
      const currTimeRange = this.getTimeRange(changes["data"]?.currentValue);
      if (prevTimeRange !== currTimeRange) {
        this.logger.info("[MetricsChart]", "Time range changed", {
          from: prevTimeRange,
          to: currTimeRange,
        });
      }
    }
  }

  private getTimeRange(data: ChartDataPoint[] | undefined): { min: number; max: number } | null {
    if (!data || data.length === 0) return null;
    const timestamps = data.map((d) => d.timestamp);
    return { min: Math.min(...timestamps), max: Math.max(...timestamps) };
  }

  ngOnDestroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = 200;
    }
    this.ctx = canvas.getContext("2d");
  }

  private drawChart(): void {
    if (!this.ctx) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;
    const dataPoints = this.data();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (dataPoints.length === 0) {
      ctx.fillStyle = "#6b7280";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No data available", canvas.width / 2, canvas.height / 2);
      return;
    }

    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;

    const values = dataPoints.map((d) => d.value);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;

    const timestamps = dataPoints.map((d) => d.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime || 1;

    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "right";

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight * i) / 4;
      const value = maxValue - (range * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);
      ctx.stroke();
      ctx.fillText(value.toFixed(0), padding.left - 5, y + 3);
    }

    ctx.textAlign = "center";
    const timeStep = chartWidth / (dataPoints.length - 1 || 1);
    for (let i = 0; i < Math.min(dataPoints.length, 5); i++) {
      const x = padding.left + (i * chartWidth) / 4;
      const timestamp = minTime + ((maxTime - minTime) * i) / 4;
      const date = new Date(timestamp);
      const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      ctx.fillText(timeStr, x, canvas.height - 5);
    }

    const color = this.color();
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!rgbMatch) return;

    const [, r, g, b] = rgbMatch;

    if (this.type() === "area") {
      ctx.beginPath();
      ctx.moveTo(padding.left, padding.top + chartHeight);
      for (let i = 0; i < dataPoints.length; i++) {
        const x = padding.left + ((dataPoints[i].timestamp - minTime) / timeRange) * chartWidth;
        const y = padding.top + (1 - (dataPoints[i].value - minValue) / range) * chartHeight;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
      ctx.closePath();

      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.05)`);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    for (let i = 0; i < dataPoints.length; i++) {
      const x = padding.left + ((dataPoints[i].timestamp - minTime) / timeRange) * chartWidth;
      const y = padding.top + (1 - (dataPoints[i].value - minValue) / range) * chartHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    if (this.type() === "bar") {
      const barWidth = Math.max(2, (chartWidth / dataPoints.length) * 0.7);
      ctx.fillStyle = color;
      for (const point of dataPoints) {
        const x =
          padding.left + ((point.timestamp - minTime) / timeRange) * chartWidth - barWidth / 2;
        const y = padding.top + (1 - (point.value - minValue) / range) * chartHeight;
        const height = padding.top + chartHeight - y;
        ctx.fillRect(x, y, barWidth, height);
      }
    } else {
      ctx.fillStyle = color;
      for (let i = 0; i < dataPoints.length; i++) {
        const x = padding.left + ((dataPoints[i].timestamp - minTime) / timeRange) * chartWidth;
        const y = padding.top + (1 - (dataPoints[i].value - minValue) / range) * chartHeight;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
