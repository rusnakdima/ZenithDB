import {
  Component,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { Router, ActivatedRoute, NavigationEnd } from "@angular/router";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { MatIconModule } from "@angular/material/icon";
import { ExplorerSidebarComponent } from "@shared/components/explorer-sidebar/explorer-sidebar.component";
import { DataStoreService } from "@services/core/data-store.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ToastService } from "@services/toast.service";
import { ClipboardService } from "@shared/services/clipboard.service";
import { ExportService } from "@shared/services/export.service";
import { PersistentStorageService } from "@shared/services/persistent-storage.service";
import { DiagnosticLoggerService } from "@shared/services/diagnostic-logger.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { LoggingService } from "@shared/services/logging.service";
import {
  CollectionMeta,
  CollectionStats,
  ColumnInfo,
  RowData,
  FilterExpression,
} from "@shared/models/connection.config";
import { formatJsonLines, highlightJsonLine, safeJsonParse } from "@shared/utils/json.utils";
import { getRecordId } from "@shared/utils/record.utils";
import { findById } from "@shared/utils/array.utils";
import { formatCompactNumber } from "@shared/utils/number.utils";
import { QUERY_CONSTANTS } from "@shared/utils/constants";
import { FormatBytesPipe } from "@shared/pipes/format-bytes.pipe";
import { InspectorDrawerComponent } from "@shared/components/inspector-drawer/inspector-drawer.component";
import { CollectionTabsComponent } from "@shared/components/collection-tabs/collection-tabs.component";
import { CompareTablesDialogComponent } from "@shared/components/compare-tables-dialog/compare-tables-dialog.component";
import { withErrorHandling } from "@shared/utils/error-handler.utils";
import { ExplorerToolbarComponent } from "@shared/components/explorer-toolbar/explorer-toolbar.component";
import { JsonViewComponent } from "@shared/components/json-view/json-view.component";
import { TableViewComponent } from "@shared/components/table-view/table-view.component";
import { ExportFormat } from "@app/features/data/export-dialog/export-dialog.component";
import { SegmentSelectorComponent } from "@shared/components/segment-selector/segment-selector.component";
import { SegmentOption } from "@shared/components/segment-selector/segment-selector.component";
import { ExplorerFilterPanelComponent } from "@shared/components/explorer-filter-panel/explorer-filter-panel.component";

type ViewTab = "table" | "json";

interface Tab {
  name: string;
  collection: string;
}

@Component({
  selector: "app-explorer",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatIconModule,
    ExplorerSidebarComponent,
    InspectorDrawerComponent,
    CollectionTabsComponent,
    CompareTablesDialogComponent,
    ExplorerToolbarComponent,
    JsonViewComponent,
    TableViewComponent,
    SegmentSelectorComponent,
    ExplorerFilterPanelComponent,
    FormatBytesPipe,
  ],
  templateUrl: "./explorer.view.html",
})
export class ExplorerComponent implements OnInit, OnDestroy {
  private store = inject(DataStoreService);
  private connectionState = inject(ConnectionStateService);
  private toast = inject(ToastService);
  private clipboard = inject(ClipboardService);
  private exportService = inject(ExportService);
  private persistentStorage = inject(PersistentStorageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private diagLogger = inject(DiagnosticLoggerService);
  private errorHandler = inject(ErrorHandlerService);
  private dataflowLogger = inject(DataflowLoggerService);
  private logger = inject(LoggingService);

  private readonly pageName = "Explorer";

  private queryParamsSub: Subscription | null = null;
  private routeSub: Subscription | null = null;
  private routeParamSub: Subscription | null = null;

  activeTabs = signal<Tab[]>([]);
  activeCollection = signal<string>("");
  stats = signal<CollectionStats | null>(null);
  collections = signal<CollectionMeta[]>([]);
  inspectorDocument = signal<RowData | null>(null);
  showInspector = signal(false);
  isCreatingDocument = signal(false);

  filterText = signal("");
  page = signal(0);
  pageSize = signal(25);
  private reloadCounter = signal(0);
  total = signal(0);
  loading = signal(false);

  viewTab = signal<ViewTab>("table");
  viewModeOptions: SegmentOption[] = [
    { id: "table", label: "Table View" },
    { id: "json", label: "JSON View" },
  ];
  availableColumns = signal<string[]>([]);
  availableColumnsMeta = signal<ColumnInfo[]>([]);
  selectedColumns = signal<string[]>([]);
  showCollectionSelector = signal(false);
  showExportMenu = signal(false);
  fullJsonData = signal<RowData[]>([]);
  jsonDocumentsMap = signal<
    Map<number, { highlightedLines: { num: number; html: string }[]; json: string }>
  >(new Map());
  jsonLoading = signal(false);
  jsonLoadProgress = signal(0);
  showCompareTables = signal(false);

  jsonOffset = signal(0);
  jsonHasMore = signal(true);
  jsonLoadingMore = signal(false);
  treeCollapsed = signal(false);

  reloadTrigger = this.reloadCounter.asReadonly();

  currentConnectionId: string | null = null;
  private pendingCollectionSelection: string | null = null;
  private collectionsLoadInitiated = false;

  async ngOnInit() {
    this.routeSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
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

    this.route.paramMap.subscribe(async (params) => {
      const collection = params.get("collection");
      if (collection && collection !== this.activeCollection()) {
        this.pendingCollectionSelection = collection;
        this.addTab(collection);
      }
    });
  }

  ngOnDestroy() {
    this.queryParamsSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.routeParamSub?.unsubscribe();
    this.fullJsonData.set([]);
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private async handleRouteChange() {
    const segments = this.router.url.split("/").filter((s) => s);
    const connIdIndex = segments.indexOf("connections");
    if (connIdIndex !== -1 && segments[connIdIndex + 1]) {
      this.currentConnectionId = segments[connIdIndex + 1];
      const conn = findById(this.store.connections(), this.currentConnectionId);
      if (conn) {
        this.connectionState.setActiveConnection(conn);
      }
    }

    const dbNameFromQuery = this.route.snapshot.queryParamMap.get("db");
    if (dbNameFromQuery) {
      this.connectionState.setActiveDatabase(dbNameFromQuery);
    }

    if (!this.currentConnectionId) {
      this.router.navigate(["/connections"]);
      return;
    }

    const initialCollection = this.route.snapshot.queryParamMap.get("collection");

    const cachedCollections = this.store.getCollections(this.currentConnectionId);
    if (cachedCollections.length > 0) {
      this.collections.set(cachedCollections);
      this.applyCollectionSelection(initialCollection);
    }

    if (!this.collectionsLoadInitiated) {
      this.collectionsLoadInitiated = true;
      this.loadCollectionsInBackground(initialCollection);
    }
  }

  private applyCollectionSelection(selectedCollection: string | null) {
    const cols = this.collections();
    if (cols.length === 0) return;

    const pendingCollection = this.pendingCollectionSelection;
    const collectionToSelect = pendingCollection || selectedCollection;

    if (collectionToSelect && cols.some((c) => c.name === collectionToSelect)) {
      this.activeCollection.set(collectionToSelect);
      this.addTab(collectionToSelect);
      this.pendingCollectionSelection = null;
      this.connectionState.setActiveCollection(collectionToSelect);
    } else if (!collectionToSelect && cols.length > 0) {
      this.activeCollection.set(cols[0].name);
      this.addTab(cols[0].name);
      this.connectionState.setActiveCollection(cols[0].name);
    }

    if (this.activeCollection()) {
      this.loadStats();
      this.loadColumns();
    }
  }

  private loadCollectionsInBackground(selectedCollection?: string | null) {
    this.loading.set(true);
    const t0 = Date.now();
    this.store
      .ensureCollectionsLoaded(this.currentConnectionId!)
      .then((cols) => {
        this.diagLogger.logDataLoad("explorer-loadCollections", cols.length, Date.now() - t0, {
          selectedCollection,
        });
        this.collections.set(cols);
        this.applyCollectionSelection(selectedCollection ?? null);
      })
      .catch(() => {
        this.toast.error("Failed to load collections");
      })
      .finally(() => {
        this.loading.set(false);
      });
  }

  async loadStats() {
    const collection = this.activeCollection();
    if (!collection) return;
    try {
      const s = await this.store.getCollectionStats(collection);
      this.stats.set(s);
      this.total.set(s.document_count);
    } catch (e) {
      this.errorHandler.handleError(e, "ExplorerComponent.loadStats");
      this.stats.set(null);
      this.total.set(0);
    }
  }

  async loadColumns(): Promise<ColumnInfo[]> {
    const collection = this.activeCollection();
    if (!collection) return [];
    try {
      const t0 = Date.now();
      const columns = await this.store.loadColumns(collection);
      this.diagLogger.logDataLoad("explorer-loadColumns", columns.length, Date.now() - t0, {
        collection,
      });
      const cols = columns.map((c) => c.name);
      this.availableColumns.set(cols);
      this.availableColumnsMeta.set(columns);
      this.selectedColumns.set([...cols]);
      return columns;
    } catch (e) {
      this.errorHandler.handleError(e, "ExplorerComponent.loadColumns");
      this.availableColumns.set([]);
      this.availableColumnsMeta.set([]);
      this.selectedColumns.set([]);
      return [];
    }
  }

  private worker: Worker | null = null;
  private pendingWorkerTasks: Map<number, unknown> = new Map();

  constructor() {
    if (typeof Worker !== "undefined") {
      this.initWorker();
    }
  }

  private initWorker() {
    this.worker = new Worker(new URL("../../workers/json-processing.worker", import.meta.url), {
      type: "module",
    });

    this.worker.onmessage = ({ data }) => {
      if (data.type === "result") {
        interface ProcessedItem {
          index: number;
          highlightedLines: Array<{ num: number; html: string }>;
          json: string;
        }
        const docMap = new Map(this.jsonDocumentsMap());
        data.processed.forEach((item: ProcessedItem) => {
          docMap.set(item.index, {
            highlightedLines: item.highlightedLines,
            json: item.json,
          });
        });
        this.jsonDocumentsMap.set(docMap);
        this.cdr.markForCheck();
      }
    };
  }

  async loadFullJsonData() {
    this.fullJsonData.set([]);
    this.jsonDocumentsMap.set(new Map());
    this.jsonOffset.set(0);
    this.jsonHasMore.set(true);
    this.jsonLoading.set(true);
    this.jsonLoadProgress.set(0);
    const BATCH_SIZE = 30;
    try {
      let filterObj: FilterExpression | undefined;
      if (this.filterText()) {
        filterObj = safeJsonParse(this.filterText(), undefined);
      }
      const t0 = Date.now();
      const result = await this.store.queryData(this.activeCollection(), {
        skip: 0,
        limit: 50,
        filter: filterObj,
      });
      const allData = result.data as RowData[];
      const totalRows = allData.length;
      this.diagLogger.logDataLoad(
        "explorer-loadFullJsonData-queryData",
        totalRows,
        Date.now() - t0,
        { hasMore: result.has_more }
      );

      this.jsonHasMore.set(result.has_more);
      this.jsonOffset.set(totalRows);

      if (this.worker) {
        const totalProcessed = { count: 0 };
        const originalHandler = this.worker.onmessage;
        this.worker.onmessage = (event) => {
          if (event.data.type === "result") {
            totalProcessed.count += event.data.processed.length;
            const progress = Math.round((totalProcessed.count / totalRows) * 100);
            this.jsonLoadProgress.set(progress);

            interface ProcessedItem {
              index: number;
              highlightedLines: Array<{ num: number; html: string }>;
              json: string;
            }
            const docMap = new Map(this.jsonDocumentsMap());
            event.data.processed.forEach((item: ProcessedItem) => {
              docMap.set(item.index, {
                highlightedLines: item.highlightedLines,
                json: item.json,
              });
            });
            this.jsonDocumentsMap.set(docMap);
            this.cdr.markForCheck();

            if (totalProcessed.count >= totalRows) {
              this.worker!.onmessage = originalHandler;
            }
          }
        };

        for (let i = 0; i < totalRows; i += BATCH_SIZE) {
          const batch = allData.slice(i, Math.min(i + BATCH_SIZE, totalRows));
          this.worker.postMessage({
            type: "process",
            documents: batch,
            startIndex: i,
          });
        }
      } else {
        const docMap = new Map<
          number,
          { highlightedLines: { num: number; html: string }[]; json: string }
        >();
        for (let i = 0; i < totalRows; i += BATCH_SIZE) {
          const batch = allData.slice(i, Math.min(i + BATCH_SIZE, totalRows));
          batch.forEach((doc, idx) => {
            const docIndex = i + idx;
            const jsonStr = JSON.stringify(doc, null, 2);
            const rawLines = jsonStr.split("\n");
            const highlightedLines = rawLines.map((line, lineIdx) => ({
              num: lineIdx + 1,
              html: highlightJsonLine(line),
            }));
            docMap.set(docIndex, {
              highlightedLines,
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
        this.jsonDocumentsMap.set(docMap);
      }

      this.fullJsonData.set(allData);
      this.jsonLoadProgress.set(100);
    } catch {
      this.toast.error("Failed to load JSON data");
    } finally {
      this.jsonLoading.set(false);
    }
  }

  async loadMoreJsonData() {
    if (this.jsonLoadingMore() || !this.jsonHasMore()) return;
    this.jsonLoadingMore.set(true);
    try {
      let filterObj: FilterExpression | undefined;
      if (this.filterText()) {
        filterObj = safeJsonParse(this.filterText(), undefined);
      }
      const t0 = Date.now();
      const result = await this.store.queryData(this.activeCollection(), {
        skip: this.jsonOffset(),
        limit: 50,
        filter: filterObj,
      });
      this.diagLogger.logDataLoad(
        "explorer-loadMoreJsonData",
        result.data.length,
        Date.now() - t0,
        { hasMore: result.has_more }
      );
      this.fullJsonData.update((current) => [...current, ...(result.data as RowData[])]);
      this.jsonHasMore.set(result.has_more);
      this.jsonOffset.update((o) => o + result.data.length);
      this.cdr.markForCheck();

      if (this.worker && result.data.length > 0) {
        const startIndex = this.jsonOffset() - result.data.length;
        this.worker.postMessage({
          type: "process",
          documents: result.data,
          startIndex,
        });
      }
    } finally {
      this.jsonLoadingMore.set(false);
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
    if (this.activeCollection() === collection) {
      if (tabs.length > 0) {
        this.selectTab(tabs[0].collection);
      } else {
        this.activeCollection.set("");
      }
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

  onViewModeChange(id: string) {
    if (id === "table" || id === "json") {
      this.viewTab.set(id);
      if (id === "json") {
        this.jsonOffset.set(0);
        this.jsonHasMore.set(true);
        this.loadFullJsonData();
      }
    }
  }

  toggleExportMenu() {
    this.showExportMenu.update((v) => !v);
  }

  toggleCollectionSelector() {
    this.showCollectionSelector.update((v) => !v);
  }

  toggleTreeCollapse() {
    this.treeCollapsed.update((v) => !v);
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
    this.logger.log("[EXPLORER]", "User action: filterApply", { filter: this.filterText() });
    this.reloadCounter.update((c) => c + 1);
    this.page.set(0);
    if (this.viewTab() === "json") {
      this.loadFullJsonData();
    }
  }

  onFilterClear() {
    this.logger.log("[EXPLORER]", "User action: filterClear");
    this.filterText.set("");
    this.page.set(0);
  }

  onRefresh() {
    this.logger.log("[EXPLORER]", "User action: refresh", { collection: this.activeCollection() });
    this.reloadCounter.update((c) => c + 1);
    this.page.set(0);
    this.loadStats();
    if (this.viewTab() === "json") {
      this.loadFullJsonData();
    }
  }

  onCreateDocument() {
    this.logger.log("[EXPLORER]", "User action: createDocument", {
      collection: this.activeCollection(),
    });
    this.isCreatingDocument.set(true);
    this.inspectorDocument.set({} as RowData);
    this.showInspector.set(true);
  }

  async onExport(format: ExportFormat) {
    this.logger.log("[EXPLORER]", "User action: export", {
      format,
      collection: this.activeCollection(),
    });
    try {
      let filterObj: FilterExpression | undefined;
      if (this.filterText()) {
        filterObj = safeJsonParse(this.filterText(), undefined);
        if (filterObj === undefined) {
          this.toast.error("Invalid filter JSON");
          return;
        }
      }
      const result = await this.store.queryData(this.activeCollection(), {
        filter: filterObj,
        limit: QUERY_CONSTANTS.MAX_LIMIT,
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

  onColumnsOrderChange(columns: string[]) {
    this.selectedColumns.set(columns);
  }

  async onImport() {
    this.logger.log("[EXPLORER]", "User action: import", { collection: this.activeCollection() });
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
        await this.store.saveRow(this.activeCollection(), row);
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
    this.viewTab.set("table");
    this.loadColumns();
  }

  openInspector(doc: RowData) {
    this.inspectorDocument.set(doc);
    this.showInspector.set(true);
  }

  closeInspector() {
    this.showInspector.set(false);
    this.inspectorDocument.set(null);
    this.isCreatingDocument.set(false);
  }

  async saveDocument(doc: RowData) {
    if (!doc || !this.activeCollection()) return;
    this.logger.log("[EXPLORER]", "User action: saveDocument", {
      collection: this.activeCollection(),
    });
    try {
      await this.store.saveRow(this.activeCollection(), doc);
      this.toast.success("Document saved");
      this.closeInspector();
      this.onRefresh();
    } catch (e) {
      this.toast.error("Failed to save document: " + (e as Error).message);
    }
  }

  async deleteDocument(doc: RowData) {
    const id = getRecordId(doc);
    this.logger.log("[EXPLORER]", "User action: deleteDocument", {
      collection: this.activeCollection(),
      id,
    });
    if (!id) {
      this.toast.error("Cannot delete: document has no ID");
      return;
    }
    try {
      await this.store.deleteRow(this.activeCollection(), String(id));
      this.toast.success("Document deleted");
      this.closeInspector();
      this.onRefresh();
    } catch (e) {
      this.toast.error("Failed to delete document: " + (e as Error).message);
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

  trackByIndex = (index: number): number => index;

  getDocLines(
    index: number
  ): { highlightedLines: { num: number; html: string }[]; json: string } | undefined {
    return this.jsonDocumentsMap().get(index);
  }

  handleDelete() {
    const doc = this.inspectorDocument();
    if (doc) {
      this.deleteDocument(doc);
    }
  }
}
