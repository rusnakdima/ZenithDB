import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { QueryCacheService, CacheEntry } from "./cache.service";
import { ToastService } from "@services/toast.service";
import { TIME_CONSTANTS } from "@shared/utils/constants";
import { formatTimeAgo } from "@shared/utils/time.utils";
import { formatBytes } from "@shared/utils/number.utils";

@Component({
  selector: "app-cache-manager",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: "./cache-manager.component.html",
})
export class CacheManagerComponent {
  private cdr = inject(ChangeDetectorRef);
  private cacheService = inject(QueryCacheService);
  private toast = inject(ToastService);

  expandedKeys = signal<Set<string>>(new Set());
  filterText = signal("");

  readonly entries = this.cacheService.entries;
  readonly stats = this.cacheService.stats;

  filteredEntries = computed(() => {
    const filter = this.filterText().toLowerCase();
    const allEntries = this.entries();

    if (!filter) return allEntries;

    return allEntries.filter((entry) => entry.key.toLowerCase().includes(filter));
  });

  toggleExpanded(key: string): void {
    const expanded = new Set(this.expandedKeys());
    if (expanded.has(key)) {
      expanded.delete(key);
    } else {
      expanded.add(key);
    }
    this.expandedKeys.set(expanded);
  }

  isExpanded(key: string): boolean {
    return this.expandedKeys().has(key);
  }

  clearEntry(key: string): void {
    this.cacheService.clearCache(key);
    this.toast.success(`Cache entry cleared`);
  }

  clearAllCache(): void {
    this.cacheService.clearCache();
    this.toast.success(`All cache cleared`);
  }

  formatAge(timestamp: number): string {
    return formatTimeAgo(timestamp);
  }

  formatBytes = formatBytes;

  formatValue(value: unknown): string {
    const str = JSON.stringify(value);
    if (str.length > 200) {
      return str.substring(0, 200) + "...";
    }
    return str;
  }
}
