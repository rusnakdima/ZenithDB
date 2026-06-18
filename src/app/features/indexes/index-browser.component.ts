import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { IndexService, IndexDefinition } from "./index.service";
import { IndexInfo } from "@shared/models/connection.config";
import { CreateIndexDialogComponent } from "./create-index-dialog.component";
import { DropIndexDialogComponent } from "./drop-index-dialog.component";
import { IndexRecommendationsComponent } from "./index-recommendations.component";
import { ToastService } from "@services/toast.service";
import { logger } from "../../services/logger.service";

type SortColumn = "name" | "type" | "fields" | "unique" | "sparse";
type SortDirection = "asc" | "desc";

@Component({
  selector: "app-index-browser",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CreateIndexDialogComponent,
    DropIndexDialogComponent,
    IndexRecommendationsComponent,
  ],
  templateUrl: "./index-browser.component.html",
})
export class IndexBrowserComponent implements OnInit {
  private readonly indexService = inject(IndexService);
  private readonly toast = inject(ToastService);

  @Input() collectionName = "";

  @Output() indexCreated = new EventEmitter<void>();
  @Output() indexDropped = new EventEmitter<void>();

  indexes = signal<IndexInfo[]>([]);
  loading = signal(false);
  error = signal("");

  searchQuery = signal("");
  sortColumn = signal<SortColumn>("name");
  sortDirection = signal<SortDirection>("asc");
  expandedIndex = signal<string | null>(null);

  showCreateDialog = signal(false);
  showDropDialog = signal(false);
  showRecommendations = signal(false);
  selectedIndex = signal<IndexInfo | null>(null);

  ngOnInit(): void {
    this.loadIndexes();
  }

  async loadIndexes(): Promise<void> {
    this.loading.set(true);
    this.error.set("");
    try {
      logger.debug("[INDEX]", "Loading indexes", { collection: this.collectionName });
      const indexes = await this.indexService.getIndexes(this.collectionName);
      this.indexes.set(indexes);
    } catch (e) {
      this.error.set((e as Error).message);
      this.toast.error("Failed to load indexes");
    } finally {
      this.loading.set(false);
    }
  }

  get filteredIndexes(): IndexInfo[] {
    let result = [...this.indexes()];

    const query = this.searchQuery().toLowerCase();
    if (query) {
      result = result.filter(
        (idx) =>
          idx.name.toLowerCase().includes(query) ||
          idx.columns.some((c) => c.toLowerCase().includes(query))
      );
    }

    result.sort((a, b) => {
      const col = this.sortColumn();
      const dir = this.sortDirection() === "asc" ? 1 : -1;

      switch (col) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "type":
          return a.name.localeCompare(b.name) * dir;
        case "fields":
          return a.columns.join(",").localeCompare(b.columns.join(",")) * dir;
        case "unique":
          return (a.is_unique === b.is_unique ? 0 : a.is_unique ? -1 : 1) * dir;
        default:
          return 0;
      }
    });

    return result;
  }

  onSort(column: SortColumn): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set("asc");
    }
  }

  getSortIcon(column: SortColumn): string {
    if (this.sortColumn() !== column) return "";
    return this.sortDirection() === "asc" ? "asc" : "desc";
  }

  toggleExpand(indexName: string): void {
    if (this.expandedIndex() === indexName) {
      this.expandedIndex.set(null);
    } else {
      this.expandedIndex.set(indexName);
    }
  }

  openCreateDialog(): void {
    this.selectedIndex.set(null);
    this.showCreateDialog.set(true);
  }

  openDropDialog(index: IndexInfo): void {
    this.selectedIndex.set(index);
    this.showDropDialog.set(true);
  }

  async onIndexCreated(indexDef: IndexDefinition): Promise<void> {
    try {
      logger.info("[INDEX]", "Creating index", {
        collection: this.collectionName,
        indexName: indexDef.name,
      });
      await this.indexService.createIndex(this.collectionName, indexDef);
      this.toast.success(`Index "${indexDef.name}" created`);
      this.showCreateDialog.set(false);
      await this.loadIndexes();
      this.indexCreated.emit();
    } catch (e) {
      this.toast.error("Failed to create index: " + (e as Error).message);
    }
  }

  async onIndexDropped(indexName: string): Promise<void> {
    try {
      logger.info("[INDEX]", "Dropping index", { collection: this.collectionName, indexName });
      await this.indexService.dropIndex(this.collectionName, indexName);
      this.toast.success(`Index "${indexName}" dropped`);
      this.showDropDialog.set(false);
      await this.loadIndexes();
      this.indexDropped.emit();
    } catch (e) {
      this.toast.error("Failed to drop index: " + (e as Error).message);
    }
  }

  async onRebuildIndex(indexName: string): Promise<void> {
    try {
      logger.info("[INDEX]", "Rebuilding index", {
        collection: this.collectionName,
        indexName,
      });
      await this.indexService.rebuildIndex(this.collectionName, indexName);
      this.toast.success(`Index "${indexName}" rebuilt`);
    } catch (e) {
      this.toast.error("Failed to rebuild index: " + (e as Error).message);
    }
  }

  toggleRecommendations(): void {
    this.showRecommendations.update((v) => !v);
  }

  trackByIndex(index: number, idx: IndexInfo): string {
    return idx.name || String(index);
  }

  getIndexJson(index: IndexInfo): string {
    return JSON.stringify(
      {
        name: index.name,
        columns: index.columns,
        is_unique: index.is_unique,
      },
      null,
      2
    );
  }
}
