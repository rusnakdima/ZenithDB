import { Component, signal, computed, inject, OnInit, OnDestroy } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { MatIconModule } from "@angular/material/icon";
import { DataGridComponent } from "@features/data/data-grid/data-grid.component";
import { SchemaTreeComponent } from "@features/schema/schema-tree/schema-tree.component";
import { FilterBarComponent } from "@shared/components/filter-bar/filter-bar.component";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ToastService } from "@services/toast.service";
import { ExportService } from "@shared/services/export.service";
import { CollectionMeta, CollectionStats } from "@shared/models/connection.config";
import { InspectorDrawerComponent } from "./inspector-drawer/inspector-drawer.component";

type ViewTab = "table" | "tree" | "json";
type SplitMode = "none" | "horizontal" | "vertical";

interface Tab {
  name: string;
  collection: string;
}

@Component({
  selector: "app-explorer",
  standalone: true,
  imports: [
    MatIconModule,
    DataGridComponent,
    SchemaTreeComponent,
    FilterBarComponent,
    InspectorDrawerComponent,
  ],
  templateUrl: "./explorer.component.html",
})
export class ExplorerComponent implements OnInit, OnDestroy {
  private db = inject(DatabaseService);
  private connectionState = inject(ConnectionStateService);
  private toast = inject(ToastService);
  private exportService = inject(ExportService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private queryParamsSub: Subscription | null = null;

  activeTabs = signal<Tab[]>([]);
  activeCollection = signal<string>("");
  stats = signal<CollectionStats | null>(null);
  collections = signal<CollectionMeta[]>([]);
  inspectorDocument = signal<any>(null);
  showInspector = signal(false);

  filterText = signal("");
  page = signal(0);
  pageSize = signal(50);
  total = signal(0);
  loading = signal(false);

  viewTab = signal<ViewTab>("table");
  splitMode = signal<SplitMode>("none");
  availableColumns = signal<string[]>([]);
  selectedColumns = signal<string[]>([]);
  showCollectionSelector = signal(false);
  fullJsonData = signal<any[]>([]);
  jsonLoading = signal(false);

  viewTabs: { id: ViewTab; label: string }[] = [
    { id: "table", label: "Table View" },
    { id: "tree", label: "Tree View" },
    { id: "json", label: "JSON View" },
  ];

  splitModes: { id: SplitMode; label: string; icon: string }[] = [
    { id: "none", label: "No Split", icon: "view_column" },
    { id: "horizontal", label: "Horizontal", icon: "vertical_split" },
    { id: "vertical", label: "Vertical", icon: "horizontal_split" },
  ];

  async ngOnInit() {
    const savedSplitMode = localStorage.getItem("explorer_split_mode") as SplitMode;
    if (savedSplitMode && ["none", "horizontal", "vertical"].includes(savedSplitMode)) {
      this.splitMode.set(savedSplitMode);
    }

    if (!this.connectionState.activeConnectionId()) {
      this.router.navigate(["/connections"]);
      return;
    }

    const initialCollection = this.route.snapshot.queryParamMap.get("collection");

    this.loading.set(true);
    try {
      await this.loadCollections(initialCollection);
    } finally {
      this.loading.set(false);
    }

    this.queryParamsSub = this.route.queryParams.subscribe((params) => {
      const collection = params["collection"];
      if (collection && collection !== this.activeCollection()) {
        this.addTab(collection);
      }
    });
  }

  ngOnDestroy() {
    this.queryParamsSub?.unsubscribe();
  }

  async loadCollections(selectedCollection?: string | null) {
    try {
      const cols = await this.db.listCollections();
      this.collections.set(cols);
      if (cols.length > 0) {
        const collectionToSelect =
          selectedCollection && cols.some((c) => c.name === selectedCollection)
            ? selectedCollection
            : cols[0].name;
        this.activeCollection.set(collectionToSelect);
        this.activeTabs.set([{ name: collectionToSelect, collection: collectionToSelect }]);
        await this.loadStats();
        await this.loadColumns();
      }
    } catch (e: any) {
      this.toast.error("Failed to load collections");
      this.loading.set(false);
    }
  }

  async loadStats() {
    const collection = this.activeCollection();
    if (!collection) return;
    try {
      const s = await this.db.getCollectionStats(collection);
      this.stats.set(s);
      this.total.set(s.document_count);
    } catch {
      this.stats.set(null);
      this.total.set(0);
    }
  }

  async loadColumns() {
    const collection = this.activeCollection();
    if (!collection) return;
    try {
      const schema = await this.db.describeCollection(collection);
      this.availableColumns.set(schema.columns.map((c) => c.name));
    } catch {
      this.availableColumns.set([]);
    }
  }

  async loadFullJsonData() {
    this.jsonLoading.set(true);
    try {
      const result = await this.db.queryData(this.activeCollection(), {
        limit: 10000,
      });
      this.fullJsonData.set(result.data);
    } catch (e: any) {
      this.toast.error("Failed to load JSON data");
    } finally {
      this.jsonLoading.set(false);
    }
  }

  addTab(collection: string) {
    const name = collection;
    const existingTab = this.activeTabs().find((t) => t.collection === collection);
    if (!existingTab) {
      this.activeTabs.update((tabs) => [...tabs, { name, collection }]);
    }
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
    this.loadColumns();
    if (this.viewTab() === "json") {
      this.loadFullJsonData();
    }
  }

  selectViewTab(tab: ViewTab) {
    this.viewTab.set(tab);
    if (tab === "json") {
      this.loadFullJsonData();
    }
  }

  toggleSplitMode() {
    const modes: SplitMode[] = ["none", "horizontal", "vertical"];
    const current = this.splitMode();
    const idx = modes.indexOf(current);
    this.splitMode.set(modes[(idx + 1) % modes.length]);
  }

  setSplitMode(mode: SplitMode) {
    this.splitMode.set(mode);
    localStorage.setItem("explorer_split_mode", mode);
  }

  toggleCollectionSelector() {
    this.showCollectionSelector.update((v) => !v);
  }

  selectCollectionFromDropdown(collection: string) {
    this.addTab(collection);
    this.showCollectionSelector.set(false);
  }

  onFilterChange(filter: string) {
    this.filterText.set(filter);
  }

  onFilterApply() {
    this.page.set(0);
  }

  onFilterClear() {
    this.filterText.set("");
    this.page.set(0);
  }

  onRefresh() {
    this.page.set(0);
    this.loadStats();
    if (this.viewTab() === "json") {
      this.loadFullJsonData();
    }
  }

  async onExport(format: "csv" | "json" | "sql") {
    try {
      let filterObj: any = undefined;
      if (this.filterText()) {
        try {
          filterObj = JSON.parse(this.filterText());
        } catch {
          this.toast.error("Invalid filter JSON");
          return;
        }
      }
      const result = await this.db.queryData(this.activeCollection(), {
        filter: filterObj,
        limit: 10000,
      });

      const exportFormat = format === "csv" ? "csv" : format === "json" ? "json" : "sql";
      const filename = `${this.activeCollection()}_export`;

      await this.exportService.export({ format: exportFormat, filename }, result.data);
    } catch (e: any) {
      this.toast.error("Export failed: " + e.message);
    }
  }

  onColumnsChange(columns: string[]) {
    this.selectedColumns.set(columns);
  }

  onTreeCollectionSelect(collection: string) {
    this.addTab(collection);
    this.selectViewTab("table");
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
      this.toast.success("Document saved");
      this.closeInspector();
    } catch (e: any) {
      this.toast.error("Failed to save document: " + e.message);
    }
  }

  async deleteDocument(doc: any) {
    const id = doc._id || doc.id;
    if (!id) return;
    try {
      await this.db.deleteRow(this.activeCollection(), id);
      this.toast.success("Document deleted");
      this.closeInspector();
      await this.loadStats();
    } catch (e: any) {
      this.toast.error("Failed to delete document: " + e.message);
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

  copyJsonToClipboard() {
    const json = JSON.stringify(this.fullJsonData(), null, 2);
    navigator.clipboard
      .writeText(json)
      .then(() => {
        this.toast.success("JSON copied to clipboard");
      })
      .catch(() => {
        this.toast.error("Failed to copy JSON");
      });
  }

  formatJsonLines(obj: any): string[] {
    const json = JSON.stringify(obj, null, 2);
    return json.split("\n");
  }

  highlightJsonLine(line: string): string {
    let result = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    result = result.replace(/("([^"\\]|\\.)*")\s*:/g, '<span class="json-key">$1</span>:');
    result = result.replace(/:\s*("([^"\\]|\\.)*")/g, ': <span class="json-string">$1</span>');
    result = result.replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>');
    result = result.replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');
    result = result.replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>');

    return result;
  }
}
