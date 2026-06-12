import {
  Component,
  input,
  output,
  signal,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { QueryCacheService, CacheEntry } from "./cache.service";
import { TIME_CONSTANTS } from "@shared/utils/constants";
import { formatTimeAgo } from "@shared/utils/time.utils";
import { AppLoggerService } from "@shared/services/app-logger.service";

@Component({
  selector: "app-cache-settings",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: "./cache-settings.component.html",
})
export class CacheSettingsComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private cacheService = inject(QueryCacheService);
  private logger = inject(AppLoggerService);

  queryKey = input<string>("");
  initialTtl = input<number>(300);

  settingsChange = output<{ enabled: boolean; ttl: number; customKey: string }>();
  close = output<void>();

  enabled = signal(true);
  ttl = signal(300);
  customKey = signal("");
  showAdvanced = signal(false);

  cacheStatus = signal<{ cached: boolean; hitCount: number; age: number; ttlRemaining: number }>({
    cached: false,
    hitCount: 0,
    age: 0,
    ttlRemaining: 0,
  });

  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.logger.debug("[QUERY_CACHE]", "Cache settings initialized", {
      initialTtl: this.initialTtl(),
    });
    this.ttl.set(this.initialTtl());
    this.refreshStatus();
    this.refreshInterval = setInterval(() => this.refreshStatus(), 1000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  private refreshStatus(): void {
    const key = this.customKey() || this.queryKey();
    if (key) {
      this.cacheStatus.set(this.cacheService.getCacheStatus(key));
    }
  }

  onEnabledChange(enabled: boolean): void {
    this.enabled.set(enabled);
    this.emitChange();
  }

  onTtlChange(ttl: number): void {
    this.ttl.set(Math.max(0, Math.min(3600, ttl)));
    this.emitChange();
  }

  onCustomKeyChange(key: string): void {
    this.customKey.set(key);
    this.refreshStatus();
    this.emitChange();
  }

  toggleAdvanced(): void {
    this.showAdvanced.update((v) => !v);
  }

  clearCache(): void {
    const key = this.customKey() || this.queryKey();
    if (key) {
      this.logger.debug("[QUERY_CACHE]", "Settings clearing cache", { key });
      this.cacheService.clearCache(key);
      this.refreshStatus();
    }
  }

  private emitChange(): void {
    this.settingsChange.emit({
      enabled: this.enabled(),
      ttl: this.ttl(),
      customKey: this.customKey(),
    });
  }

  get formattedAge(): string {
    return formatTimeAgo(this.cacheStatus().age);
  }

  get formattedTtlRemaining(): string {
    const ttl = this.cacheStatus().ttlRemaining;
    if (ttl <= 0) return "expired";
    if (ttl < TIME_CONSTANTS.ONE_SECOND_MS) return "< 1s";
    if (ttl < TIME_CONSTANTS.ONE_MINUTE_MS)
      return `${Math.floor(ttl / TIME_CONSTANTS.ONE_SECOND_MS)}s`;
    if (ttl < TIME_CONSTANTS.ONE_HOUR_MS)
      return `${Math.floor(ttl / TIME_CONSTANTS.ONE_MINUTE_MS)}m`;
    return `${Math.floor(ttl / TIME_CONSTANTS.ONE_HOUR_MS)}h`;
  }
}
