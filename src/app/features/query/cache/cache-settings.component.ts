import { Component, input, output, signal, inject, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { QueryCacheService, CacheEntry } from "./cache.service";

@Component({
  selector: "app-cache-settings",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./cache-settings.component.html",
})
export class CacheSettingsComponent implements OnInit, OnDestroy {
  private cacheService = inject(QueryCacheService);

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
    const age = this.cacheStatus().age;
    if (age < 1000) return "< 1s";
    if (age < 60000) return `${Math.floor(age / 1000)}s`;
    if (age < 3600000) return `${Math.floor(age / 60000)}m`;
    return `${Math.floor(age / 3600000)}h`;
  }

  get formattedTtlRemaining(): string {
    const ttl = this.cacheStatus().ttlRemaining;
    if (ttl <= 0) return "expired";
    if (ttl < 1000) return "< 1s";
    if (ttl < 60000) return `${Math.floor(ttl / 1000)}s`;
    if (ttl < 3600000) return `${Math.floor(ttl / 60000)}m`;
    return `${Math.floor(ttl / 3600000)}h`;
  }
}
