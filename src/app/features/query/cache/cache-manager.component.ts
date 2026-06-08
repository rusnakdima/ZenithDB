import { Component, inject, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { QueryCacheService, CacheEntry } from "./cache.service";
import { ToastService } from "@services/toast.service";

@Component({
  selector: "app-cache-manager",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./cache-manager.component.html",
})
export class CacheManagerComponent {
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

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatAge(timestamp: number): string {
    const age = Date.now() - timestamp;
    if (age < 60000) return `${Math.floor(age / 1000)}s ago`;
    if (age < 3600000) return `${Math.floor(age / 60000)}m ago`;
    return `${Math.floor(age / 3600000)}h ago`;
  }

  formatValue(value: unknown): string {
    const str = JSON.stringify(value);
    if (str.length > 200) {
      return str.substring(0, 200) + "...";
    }
    return str;
  }
}
