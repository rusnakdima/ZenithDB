import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  Output,
  EventEmitter,
} from "@angular/core";
import { Router, RouterLink, ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { DataStoreService } from "@services/core/data-store.service";
import { ToastService } from "@services/toast.service";
import { ConfirmService } from "@shared/services/confirm.service";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ErrorHandlerService } from "@shared/services/error-handler.service";
import { MatIconModule } from "@angular/material/icon";
import { SkeletonLoaderComponent } from "@shared/components/loading/skeleton-loader.component";
import { CollectionMeta, ColumnInfo } from "@shared/models/connection.config";
import { withErrorHandling } from "@shared/utils/error-handler.utils";

interface TreeNode {
  name: string;
  type: "database" | "collection" | "field";
  count?: number;
  expanded?: boolean;
  fields?: FieldNode[];
  selected?: boolean;
}

interface FieldNode {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

interface ContextMenu {
  show: boolean;
  x: number;
  y: number;
  node: TreeNode | null;
}

@Component({
  selector: "app-schema-tree",
  standalone: true,
  imports: [FormsModule, MatIconModule, SkeletonLoaderComponent],
  templateUrl: "./schema-tree.component.html",
})
export class SchemaTreeComponent implements OnInit, OnDestroy {
  collections = signal<TreeNode[]>([]);
  filteredCollections = signal<TreeNode[]>([]);
  expanded = signal<Set<string>>(new Set());
  selectedCollection = signal<string | null>(null);
  loading = signal(false);
  error = signal("");
  searchQuery = signal("");
  contextMenu = signal<ContextMenu>({ show: false, x: 0, y: 0, node: null });
  showNewCollectionModal = signal(false);
  newCollectionName = "";
  renamingCollection = signal<string | null>(null);
  renameValue = "";
  selectedNode = signal<TreeNode | null>(null);

  @Output() collectionSelect = new EventEmitter<string>();

  private store = inject(DataStoreService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private connectionState = inject(ConnectionStateService);
  private confirm = inject(ConfirmService);
  private errorHandler = inject(ErrorHandlerService);
  private boundCloseContextMenu: (() => void) | null = null;

  ngOnInit() {
    this.loadCollections();
    this.boundCloseContextMenu = () => this.closeContextMenu();
    document.addEventListener("click", this.boundCloseContextMenu);
  }

  ngOnDestroy(): void {
    if (this.boundCloseContextMenu) {
      document.removeEventListener("click", this.boundCloseContextMenu);
    }
  }

  async loadCollections() {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) return;

    const result = await withErrorHandling(
      async () => {
        const cols = await this.store.listCollectionsPaginated(connId);
        return cols;
      },
      {
        loading: this.loading,
        context: "LoadCollections",
        errorMessage: "Failed to load collections",
      },
      { errorHandler: this.errorHandler, toastService: this.toast }
    );

    if (result.success && result.data) {
      this.collections.set(
        result.data.collections.map((c: CollectionMeta) => ({
          name: c.name,
          type: "collection" as const,
          count: c.count,
          expanded: false,
          fields: [],
        }))
      );
      this.applyFilter();
    } else {
      this.error.set("Failed to load collections");
    }
  }

  async loadCollectionFields(collection: TreeNode) {
    if (collection.fields && collection.fields.length > 0) return;
    try {
      const schema = await this.store.describeCollection(collection.name);
      collection.fields = schema.columns.map((col: ColumnInfo) => ({
        name: col.name,
        dataType: col.data_type,
        nullable: col.nullable,
        isPrimaryKey: col.is_primary_key,
      }));
      this.collections.update((cols) => [...cols]);
    } catch {
      this.toast.error(`Failed to load fields for ${collection.name}`);
    }
  }

  toggleExpand(name: string, event: MouseEvent) {
    event.stopPropagation();
    const current = new Set(this.expanded());
    if (current.has(name)) {
      current.delete(name);
    } else {
      current.add(name);
      const col = this.collections().find((c) => c.name === name);
      if (col) this.loadCollectionFields(col);
    }
    this.expanded.set(current);
  }

  isExpanded(name: string): boolean {
    return this.expanded().has(name);
  }

  selectCollection(collection: TreeNode) {
    this.selectedCollection.set(collection.name);
    this.selectedNode.set(collection);
    this.collectionSelect.emit(collection.name);
  }

  onContextMenu(event: MouseEvent, node: TreeNode) {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.set({
      show: true,
      x: event.clientX,
      y: event.clientY,
      node,
    });
    this.selectCollection(node);
  }

  closeContextMenu() {
    this.contextMenu.set({ show: false, x: 0, y: 0, node: null });
  }

  refresh() {
    this.loadCollections();
    this.toast.info("Schema refreshed");
  }

  openNewCollectionModal() {
    this.closeContextMenu();
    this.newCollectionName = "";
    this.showNewCollectionModal.set(true);
  }

  async createCollection() {
    const name = this.newCollectionName.trim();
    if (!name) {
      this.toast.warning("Collection name is required");
      return;
    }
    try {
      await this.store.createCollection(name);
      this.toast.success(`Collection "${name}" created`);
      this.showNewCollectionModal.set(false);
      this.loadCollections();
    } catch {
      this.toast.error("Failed to create collection");
    }
  }

  closeNewCollectionModal() {
    this.showNewCollectionModal.set(false);
  }

  startRename(node: TreeNode) {
    this.closeContextMenu();
    this.renamingCollection.set(node.name);
    this.renameValue = node.name;
  }

  async confirmRename() {
    const oldName = this.renamingCollection();
    if (!oldName) return;
    const newName = this.renameValue.trim();
    if (!newName || newName === oldName) {
      this.renamingCollection.set(null);
      return;
    }
    try {
      await this.store.dropCollection(oldName);
      await this.store.createCollection(newName);
      this.toast.success(`Renamed to "${newName}"`);
      this.renamingCollection.set(null);
      this.loadCollections();
    } catch {
      this.toast.error("Failed to rename collection");
    }
  }

  cancelRename() {
    this.renamingCollection.set(null);
  }

  async dropCollection(node: TreeNode) {
    this.closeContextMenu();
    if (await this.confirm.confirmDelete(node.name)) {
      try {
        await this.store.dropCollection(node.name);
        this.toast.success(`Collection "${node.name}" dropped`);
        if (this.selectedCollection() === node.name) {
          this.selectedCollection.set(null);
          const connId = this.connectionState.activeConnectionId();
          const dbName = this.connectionState.activeDatabaseName();
          if (connId && dbName) {
            this.router.navigate(["/connections", connId, dbName, "explorer"]);
          } else {
            this.router.navigate(["/connections"]);
          }
        }
        this.loadCollections();
      } catch {
        this.toast.error("Failed to drop collection");
      }
    }
  }

  viewData(collection: TreeNode) {
    const connId = this.connectionState.activeConnectionId();
    const dbName = this.connectionState.activeDatabaseName();
    if (connId && dbName) {
      this.router.navigate(["/connections", connId, dbName, "explorer"], {
        queryParams: { collection: collection.name },
      });
    }
  }

  viewDetails(collection: TreeNode) {
    const connId = this.connectionState.activeConnectionId();
    const dbName = this.connectionState.activeDatabaseName();
    if (connId && dbName) {
      this.router.navigate(["/connections", connId, dbName, "explorer"], {
        queryParams: { collection: collection.name, view: "schema" },
      });
    }
  }

  setFilter(query: string) {
    this.searchQuery.set(query);
    this.applyFilter();
  }

  applyFilter() {
    const query = this.searchQuery().toLowerCase();
    if (!query) {
      this.filteredCollections.set(this.collections());
    } else {
      this.filteredCollections.set(
        this.collections().filter((c) => c.name.toLowerCase().includes(query))
      );
    }
  }

  getFieldTypeIcon(dataType: string): string {
    switch (dataType.toLowerCase()) {
      case "string":
      case "text":
        return "text-blue-400";
      case "number":
      case "integer":
      case "decimal":
      case "float":
        return "text-orange-400";
      case "boolean":
        return "text-orange-400";
      case "date":
      case "datetime":
      case "timestamp":
        return "text-purple-400";
      case "object":
      case "json":
        return "text-yellow-400";
      case "array":
        return "text-pink-400";
      default:
        return "text-slate-400";
    }
  }

  trackByName(index: number, node: TreeNode): string {
    return node.name;
  }
}
