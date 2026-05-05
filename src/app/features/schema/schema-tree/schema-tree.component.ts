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
import { DatabaseService } from "@shared/services/database.service";
import { ToastService } from "@services/toast.service";
import { SkeletonLoaderComponent } from "@shared/components/loading/skeleton-loader.component";
import { CollectionMeta, ColumnInfo } from "@shared/models/connection.config";

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
  imports: [RouterLink, FormsModule, SkeletonLoaderComponent],
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

  private db = inject(DatabaseService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
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
    this.loading.set(true);
    this.error.set("");
    try {
      const cols = await this.db.listCollections();
      this.collections.set(
        cols.map((c: CollectionMeta) => ({
          name: c.name,
          type: "collection" as const,
          count: c.count,
          expanded: false,
          fields: [],
        }))
      );
      this.applyFilter();
    } catch {
      this.error.set("Failed to load collections");
      this.toast.error(this.error());
    } finally {
      this.loading.set(false);
    }
  }

  async loadCollectionFields(collection: TreeNode) {
    if (collection.fields && collection.fields.length > 0) return;
    try {
      const schema = await this.db.describeCollection(collection.name);
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
      await this.db.createCollection(name);
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
      await this.db.dropCollection(oldName);
      await this.db.createCollection(newName);
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
    if (confirm(`Drop collection "${node.name}"? This cannot be undone.`)) {
      try {
        await this.db.dropCollection(node.name);
        this.toast.success(`Collection "${node.name}" dropped`);
        if (this.selectedCollection() === node.name) {
          this.selectedCollection.set(null);
          this.router.navigate(["/schema"]);
        }
        this.loadCollections();
      } catch {
        this.toast.error("Failed to drop collection");
      }
    }
  }

  viewData(collection: TreeNode) {
    this.router.navigate(["/data", collection.name]);
  }

  viewDetails(collection: TreeNode) {
    this.router.navigate(["/schema", collection.name]);
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
