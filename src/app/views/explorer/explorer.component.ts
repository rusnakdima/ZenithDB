import { Component, signal, computed, inject } from "@angular/core";
import { DataGridComponent } from "../../features/data/data-grid/data-grid.component";
import { FilterBarComponent } from "../../shared/components/filter-bar/filter-bar.component";
import { InspectorDrawerComponent } from "./inspector-drawer/inspector-drawer.component";
import { DatabaseService } from "../../shared/services/database.service";
import { CollectionMeta, CollectionStats } from "../../shared/models/connection.config";

interface Tab {
  name: string;
  collection: string;
}

@Component({
  selector: "app-explorer",
  standalone: true,
  imports: [DataGridComponent, FilterBarComponent, InspectorDrawerComponent],
  templateUrl: "./explorer.component.html",
  styleUrl: "./explorer.component.css",
})
export class ExplorerComponent {
  private db = inject(DatabaseService);

  activeTabs = signal<Tab[]>([{ name: "orders", collection: "orders" }]);
  activeCollection = signal<string>("orders");
  stats = signal<CollectionStats | null>(null);
  collections = signal<CollectionMeta[]>([]);
  inspectorDocument = signal<any>(null);
  showInspector = signal(false);

  filterText = signal("");
  page = signal(0);
  pageSize = signal(50);
  total = signal(0);
  loading = signal(false);

  viewMode = signal<"grid" | "json">("grid");

  async ngOnInit() {
    await this.loadCollections();
    await this.loadStats();
  }

  async loadCollections() {
    try {
      const cols = await this.db.listCollections();
      this.collections.set(cols);
    } catch {}
  }

  async loadStats() {
    try {
      const s = await this.db.getCollectionStats(this.activeCollection());
      this.stats.set(s);
    } catch {}
  }

  addTab(collection: string) {
    const name = collection;
    if (this.activeTabs().find((t) => t.collection === collection)) return;
    this.activeTabs.update((tabs) => [...tabs, { name, collection }]);
    this.selectTab(collection);
  }

  closeTab(collection: string) {
    const tabs = this.activeTabs().filter((t) => t.collection !== collection);
    this.activeTabs.set(tabs);
    if (this.activeCollection() === collection && tabs.length > 0) {
      this.selectTab(tabs[0].collection);
    }
  }

  selectTab(collection: string) {
    this.activeCollection.set(collection);
    this.page.set(0);
    this.loadStats();
  }

  onFilterChange(filter: string) {
    this.filterText.set(filter);
    this.page.set(0);
  }

  onFilterApply() {
    this.page.set(0);
  }

  onFilterClear() {
    this.filterText.set("");
    this.page.set(0);
  }

  toggleViewMode() {
    this.viewMode.update((v) => (v === "grid" ? "json" : "grid"));
  }

  openInspector(doc: any) {
    this.inspectorDocument.set(doc);
    this.showInspector.set(true);
  }

  closeInspector() {
    this.showInspector.set(false);
    this.inspectorDocument.set(null);
  }

  async saveDocument(doc: any) {
    try {
      await this.db.saveRow(this.activeCollection(), doc);
      this.closeInspector();
    } catch {}
  }

  async deleteDocument(doc: any) {
    const id = doc._id || doc.id;
    if (!id) return;
    if (confirm("Delete this document permanently?")) {
      await this.db.deleteRow(this.activeCollection(), id);
      this.closeInspector();
    }
  }

  onPageChange(newPage: number) {
    this.page.set(newPage);
  }

  async nextPage() {
    this.page.update((p) => p + 1);
  }

  async prevPage() {
    this.page.update((p) => Math.max(0, p - 1));
  }

  async changePageSize(size: number) {
    this.pageSize.set(size);
    this.page.set(0);
  }

  get totalPages() {
    return Math.ceil(this.total() / this.pageSize());
  }

  get hasNextPage() {
    return this.page() < this.totalPages - 1;
  }

  get hasPrevPage() {
    return this.page() > 0;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  formatDocumentCount(count: number): string {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + "M";
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + "K";
    }
    return count.toString();
  }
}
