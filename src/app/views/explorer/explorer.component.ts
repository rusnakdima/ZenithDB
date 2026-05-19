import { Component, signal, computed, inject, OnInit, OnDestroy } from "@angular/core";
import { Router, ActivatedRoute, NavigationEnd } from "@angular/router";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { MatIconModule } from "@angular/material/icon";
import { DataGridComponent } from "@features/data/data-grid/data-grid.component";
import { SchemaTreeComponent } from "@features/schema/schema-tree/schema-tree.component";
import { FilterBarComponent } from "@shared/components/filter-bar/filter-bar.component";
import { DatabaseService } from "@shared/services/database.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { DataStoreService } from "@services/core/data-store.service";
import { ToastService } from "@services/toast.service";
import { ClipboardService } from "@shared/services/clipboard.service";
import { ExportService } from "@shared/services/export.service";
import { PersistentStorageService, SplitMode } from "@shared/services/persistent-storage.service";
import {
  CollectionMeta,
  CollectionStats,
  ColumnInfo,
  RowData,
  FilterExpression,
} from "@shared/models/connection.config";
import { FormatBytesPipe } from "@shared/pipes/format-bytes.pipe";
import { formatJsonLines, highlightJsonLine, safeJsonParse } from "@shared/utils/json.utils";
import { formatCompactNumber } from "@shared/utils/number.utils";
import { InspectorDrawerComponent } from "./inspector-drawer/inspector-drawer.component";
import { CollectionTabsComponent } from "./collection-tabs/collection-tabs.component";
import { ViewSwitcherComponent } from "./view-switcher/view-switcher.component";
import { PaginationComponent } from "@shared/components/pagination/pagination.component";
import { CompareTablesDialogComponent } from "./compare-tables-dialog/compare-tables-dialog.component";
import { withErrorHandling } from "@shared/utils/error-handler.utils";

type ViewTab = "table" | "tree" | "json";

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
    CollectionTabsComponent,
    ViewSwitcherComponent,
    CompareTablesDialogComponent,
    FormatBytesPipe,
  ],
  templateUrl: "./explorer.component.html",
})
export class ExplorerComponent implements OnInit, OnDestroy {
  private db = inject(DatabaseService);
  private connectionState = inject(ConnectionStateService);
  private dataStore = inject(DataStoreService);
  private toast = inject(ToastService);
  private clipboard = inject(ClipboardService);
  private exportService = inject(ExportService);
  private persistentStorage = inject(PersistentStorageService);
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
  jsonDocumentsMap = signal<Map<number, { lines: string[]; json: string }>>(new Map());
  jsonLoading = signal(false);
  jsonLoadProgress = signal(0);
  showCompareTables = signal(false);

  currentConnectionId: string | null = null;
  private pendingCollectionSelection: string | null = null;

  async ngOnInit() {
    const savedSplitMode = this.persistentStorage.getExplorerSplitMode();
    if (savedSplitMode) {
      this.splitMode.set(savedSplitMode);
    }

    this.routeSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.handleRouteChange();
      });

    this.handleRouteChange();

    this.queryParamsSub = this.route.queryParams.subscribe(async (params) => {
      const collection = params["collection"];
      if (collection && collection !== this.activeCollection()) {
        this.pendingCollectionSelection = collection;
        this.addTab(collection);
      }
      const view = params["view"];
      if (view === "schema" && collection) {
        const schema = await this.loadColumns();
        if (schema.length > 0) {
          this.inspectorDocument.set({ _schema: schema } as RowData);
          this.showInspector.set(true);
        }
      }
    });
  }

  ngOnDestroy() {
    this.queryParamsSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.fullJsonData.set([]);
  }

  private async handleRouteChange() {
    const segments = this.router.url.split("/").filter((s) => s);
    const connIdIndex = segments.indexOf("connections");
    if (connIdIndex !== -1 && segments[connIdIndex + 1]) {
      this.currentConnectionId = segments[connIdIndex + 1];
      const conn = this.dataStore.connections().find((c) => c.id === this.currentConnectionId);
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
    if (!result.success || !result.data) return;

    const cols = result.data;
    this.collections.set(cols);

    const pendingCollection = this.pendingCollectionSelection;
    const collectionToSelect = pendingCollection || selectedCollection;

    if (cols.length > 0) {
      if (collectionToSelect && cols.some((c) => c.name === collectionToSelect)) {
        this.activeCollection.set(collectionToSelect);
        this.activeTabs.set([{ name: collectionToSelect, collection: collectionToSelect }]);
        this.pendingCollectionSelection = null;
      } else if (!collectionToSelect && cols.length > 0) {
        this.activeCollection.set(cols[0].name);
        this.activeTabs.set([{ name: cols[0].name, collection: cols[0].name }]);
      }
      this.loadStats();
      this.loadColumns();
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

  async loadColumns(): Promise<ColumnInfo[]> {
    const collection = this.activeCollection();
    if (!collection) return [];
    try {
      const columns = await this.dataStore.loadColumns(collection);
      const cols = columns.map((c) => c.name);
      this.availableColumns.set(cols);
      this.availableColumnsMeta.set(columns);
      this.selectedColumns.set([...cols]);
      return columns;
    } catch {
      this.availableColumns.set([]);
      this.availableColumnsMeta.set([]);
      this.selectedColumns.set([]);
      return [];
    }
  }

  async loadFullJsonData() {
    this.fullJsonData.set([]);
    this.jsonDocumentsMap.set(new Map());
    this.jsonLoading.set(true);
    this.jsonLoadProgress.set(0);
    const BATCH_SIZE = 30;
    try {
      const result = await this.db.queryData(this.activeCollection(), {
        limit: 30,
      });
      const allData = result.data as RowData[];
      const totalRows = allData.length;
      const docMap = new Map<number, { lines: string[]; json: string }>();

      for (let i = 0; i < totalRows; i += BATCH_SIZE) {
        const batch = allData.slice(i, Math.min(i + BATCH_SIZE, totalRows));
        batch.forEach((doc, idx) => {
          const docIndex = i + idx;
          const jsonStr = JSON.stringify(doc, null, 2);
          docMap.set(docIndex, {
            lines: jsonStr.split("\n"),
            json: jsonStr,
          });
        });

        const progress = Math.round(((i + batch.length) / totalRows) * 100);
        this.jsonLoadProgress.set(progress);

        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            setTimeout(() => resolve(), 0);
          });
        });
      }

      this.fullJsonData.set(allData);
      this.jsonDocumentsMap.set(docMap);
      this.jsonLoadProgress.set(100);
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
    this.fullJsonData.set([]);
    this.jsonDocumentsMap.set(new Map());
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
    this.persistentStorage.setExplorerSplitMode(mode);
  }

  toggleCollectionSelector() {
    this.showCollectionSelector.update((v) => !v);
  }

  openCompareTables() {
    this.showCompareTables.set(true);
  }

  closeCompareTables() {
    this.showCompareTables.set(false);
  }

  selectCollectionFromDropdown(collection: string) {
    this.addTab(collection);
    this.showCollectionSelector.set(false);
    this.selectTab(collection);
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
        filterObj = safeJsonParse(this.filterText(), undefined);
        if (filterObj === undefined) {
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
    if (this.viewTab() === "table") {
      this.reloadCounter.update((c) => c + 1);
    }
  }

  async onImport() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");

      const filePath = await open({
        multiple: false,
        filters: [
          { name: "Data Files", extensions: ["csv", "json"] },
          { name: "CSV Files", extensions: ["csv"] },
          { name: "JSON Files", extensions: ["json"] },
        ],
      });

      if (!filePath) return;

      const content = await readTextFile(filePath as string);
      const filename = (filePath as string).split(/[/\\]/).pop() || "import";
      const ext = filename.split(".").pop()?.toLowerCase();

      if (ext === "csv") {
        await this.importCsv(content);
      } else if (ext === "json") {
        await this.importJson(content);
      } else {
        this.toast.error("Unsupported file format");
      }
    } catch (e) {
      this.toast.error("Import failed: " + (e as Error).message);
    }
  }

  private async importCsv(content: string) {
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      this.toast.error("CSV file must have header and at least one data row");
      return;
    }

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || null;
      });
      return row;
    });

    await this.importData(rows);
  }

  private async importJson(content: string) {
    try {
      const data = JSON.parse(content);
      const rows = Array.isArray(data) ? data : [data];
      await this.importData(rows);
    } catch {
      this.toast.error("Invalid JSON format");
    }
  }

  private async importData(rows: Record<string, unknown>[]) {
    try {
      let imported = 0;
      for (const row of rows) {
        await this.db.saveRow(this.activeCollection(), row);
        imported++;
      }
      this.toast.success(`Imported ${imported} rows`);
      this.reloadCounter.update((c) => c + 1);
      this.loadStats();
    } catch (e) {
      this.toast.error("Import failed: " + (e as Error).message);
    }
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

  async saveDocument(doc: RowData) {}

  async deleteDocument(doc: RowData) {}

  onPageChange(newPage: number) {
    this.page.set(newPage);
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.page.set(0);
  }

  formatDocumentCount(count: number): string {
    return formatCompactNumber(count);
  }

  copyJsonToClipboard() {
    const json = JSON.stringify(this.fullJsonData(), null, 2);
    this.clipboard.copyToClipboard(json, "JSON copied to clipboard");
  }

  copyRowJson(doc: RowData, docIndex: number) {
    const cached = this.jsonDocumentsMap().get(docIndex);
    const json = cached ? cached.json : JSON.stringify(doc, null, 2);
    this.clipboard.copyToClipboard(json, "Copied to clipboard");
  }

  getReloadTrigger(): number {
    return this.reloadCounter();
  }

  formatJsonLinesFn = (obj: unknown): string[] => formatJsonLines(JSON.stringify(obj, null, 2));
  highlightJsonLineFn = highlightJsonLine;
  trackByIndex = (index: number): number => index;

  getDocLines(index: number): { lines: string[]; json: string } | undefined {
    return this.jsonDocumentsMap().get(index);
  }

  handleDelete() {
    const doc = this.inspectorDocument();
    if (doc) {
      this.deleteDocument(doc);
    }
  }
}
