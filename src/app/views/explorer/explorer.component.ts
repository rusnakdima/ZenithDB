import { Component, signal, computed, inject, OnInit, OnDestroy, effect } from "@angular/core";
import { Router, ActivatedRoute, NavigationEnd } from "@angular/router";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { MatIconModule } from "@angular/material/icon";
import { DataGridComponent } from "@features/data/data-grid/data-grid.component";
import { SchemaTreeComponent } from "@features/schema/schema-tree/schema-tree.component";
import { FilterBarComponent } from "@shared/components/filter-bar/filter-bar.component";
import { DatabaseService } from "@shared/services/database.service";
import { DataProviderService } from "@shared/services/data-provider.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { StorageService } from "@services/core/storage.service";
import { ToastService } from "@services/toast.service";
import { ExportService } from "@shared/services/export.service";
import {
  CollectionMeta,
  CollectionStats,
  ColumnInfo,
  RowData,
  FilterExpression,
} from "@shared/models/connection.config";
import { FormatBytesPipe } from "@shared/pipes/format-bytes.pipe";
import { formatJsonLines, highlightJsonLine } from "@shared/utils/json.utils";
import { InspectorDrawerComponent } from "./inspector-drawer/inspector-drawer.component";
import { PaginationComponent } from "@shared/components/pagination/pagination.component";
import { withErrorHandling } from "@shared/utils/error-handler.utils";

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
    ScrollingModule,
    MatIconModule,
    DataGridComponent,
    SchemaTreeComponent,
    FilterBarComponent,
    InspectorDrawerComponent,
    FormatBytesPipe,
    PaginationComponent,
  ],
  templateUrl: "./explorer.component.html",
})
export class ExplorerComponent implements OnInit, OnDestroy {
  private db = inject(DatabaseService);
  private dataProvider = inject(DataProviderService);
  private connectionState = inject(ConnectionStateService);
  private storage = inject(StorageService);
  private toast = inject(ToastService);
  private exportService = inject(ExportService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private queryParamsSub: Subscription | null = null;
  private routeSub: Subscription | null = null;

  activeTabs = signal<Tab[]>([]);
  activeCollection = signal<string>("");
  stats = signal<CollectionStats | null>(null);
  collections = signal<CollectionMeta[]>([]);
  inspectorDocument = signal<RowData | null>(null);
  showInspector = signal(false);

  filterText = signal("");
  page = signal(0);
  pageSize = signal(50);
  private reloadCounter = signal(0);
  total = signal(0);
  loading = signal(false);

  viewTab = signal<ViewTab>("table");
  splitMode = signal<SplitMode>("none");
  availableColumns = signal<string[]>([]);
  availableColumnsMeta = signal<ColumnInfo[]>([]);
  selectedColumns = signal<string[]>([]);
  showCollectionSelector = signal(false);
  fullJsonData = signal<RowData[]>([]);
  jsonLoading = signal(false);

  private currentConnectionId: string | null = null;

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

    this.routeSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.handleRouteChange();
      });

    this.handleRouteChange();

    this.queryParamsSub = this.route.queryParams.subscribe((params) => {
      const collection = params["collection"];
      if (collection && collection !== this.activeCollection()) {
        this.addTab(collection);
      }
    });
  }

  ngOnDestroy() {
    this.queryParamsSub?.unsubscribe();
    this.routeSub?.unsubscribe();
  }

  private async handleRouteChange() {
    const segments = this.router.url.split("/").filter((s) => s);
    const connIdIndex = segments.indexOf("connections");
    if (connIdIndex !== -1 && segments[connIdIndex + 1]) {
      this.currentConnectionId = segments[connIdIndex + 1];
      const conn = this.storage.connections().find((c) => c.id === this.currentConnectionId);
      if (conn) {
        this.connectionState.setActiveConnection(conn);
      }
    }

    if (!this.currentConnectionId) {
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
  }

  async loadCollections(selectedCollection?: string | null) {
    const result = await withErrorHandling(() => this.db.listCollections(), {
      loading: this.loading,
      errorMessage: "Failed to load collections",
    });
    if (!result.success) return;

    const cols = result.data!;
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
      const cols = schema.columns.map((c) => c.name);
      this.availableColumns.set(cols);
      this.availableColumnsMeta.set(schema.columns);
      this.selectedColumns.set([...cols]);
    } catch {
      this.availableColumns.set([]);
      this.availableColumnsMeta.set([]);
      this.selectedColumns.set([]);
    }
  }

  async loadFullJsonData() {
    this.jsonLoading.set(true);
    try {
      const result = await this.db.queryData(this.activeCollection(), {
        limit: 10000,
      });
      this.fullJsonData.set(result.data as RowData[]);
    } catch {
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
    this.loadColumns();
  }

  onFilterChange(filter: string) {
    this.filterText.set(filter);
  }

  onFilterApply() {
    this.reloadCounter.update((c) => c + 1);
    this.page.set(0);
  }

  onFilterClear() {
    this.filterText.set("");
    this.page.set(0);
  }

  onRefresh() {
    this.reloadCounter.update((c) => c + 1);
    this.page.set(0);
    this.loadStats();
    if (this.viewTab() === "json") {
      this.loadFullJsonData();
    }
  }

  onToggleView() {
    if (this.viewTab() === "json") {
      this.selectViewTab("table");
    } else {
      this.selectViewTab("json");
    }
  }

  async onExport(format: "csv" | "json" | "sql") {
    try {
      let filterObj: FilterExpression | undefined;
      if (this.filterText()) {
        try {
          filterObj = JSON.parse(this.filterText()) as FilterExpression;
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
    } catch (e) {
      this.toast.error("Export failed: " + (e as Error).message);
    }
  }

  onColumnsChange(columns: string[]) {
    this.selectedColumns.set(columns);
  }

  getDisabledColumns(): string[] {
    return this.availableColumnsMeta()
      .filter((col) => col.is_primary_key)
      .map((col) => col.name);
  }

  onTreeCollectionSelect(collection: string) {
    this.addTab(collection);
    this.selectViewTab("table");
    this.loadColumns();
  }

  openInspector(doc: RowData) {
    this.inspectorDocument.set(doc);
    this.showInspector.set(true);
  }

  closeInspector() {
    this.showInspector.set(false);
    this.inspectorDocument.set(null);
  }

  async saveDocument(doc: RowData) {
    const result = await withErrorHandling(() => this.db.saveRow(this.activeCollection(), doc), {
      toast: true,
      toastSuccess: "Document saved",
      errorMessage: "Failed to save document",
    });
    if (result.success) {
      this.closeInspector();
    }
  }

  async deleteDocument(doc: RowData) {
    const id = (doc["_id"] || doc["id"]) as string;
    if (!id) return;
    const result = await withErrorHandling(() => this.db.deleteRow(this.activeCollection(), id), {
      toast: true,
      toastSuccess: "Document deleted",
      errorMessage: "Failed to delete document",
    });
    if (result.success) {
      this.closeInspector();
      await this.loadStats();
    }
  }

  onPageChange(newPage: number) {
    this.page.set(newPage);
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.page.set(0);
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

  getReloadTrigger(): number {
    return this.reloadCounter();
  }

  formatJsonLinesFn = (obj: unknown): string[] => formatJsonLines(JSON.stringify(obj, null, 2));
  highlightJsonLineFn = highlightJsonLine;
  trackByIndex = (index: number): number => index;

  handleDelete() {
    const doc = this.inspectorDocument();
    if (doc) {
      this.deleteDocument(doc);
    }
  }
}
