import { Component, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { DatabaseService } from "@shared/services/database.service";
import { ToastService } from "@services/toast.service";
import { ExportService } from "@shared/services/export.service";
import { SkeletonLoaderComponent } from "@shared/components/loading/skeleton-loader.component";
import { FormatBytesPipe } from "@shared/pipes/format-bytes.pipe";
import { SortableHeaderComponent } from "@shared/components/sortable-header/sortable-header.component";
import { DataTypeBadgeComponent } from "@shared/components/data-type-badge/data-type-badge.component";
import { PageContainerComponent } from "@shared/components/page-container/page-container.component";
import { ModalComponent } from "@shared/components/modal/modal.component";

interface FieldInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  is_primary_key: boolean;
  default_value?: any;
  description?: string;
}

interface IndexInfo {
  name: string;
  columns: string[];
  is_unique: boolean;
}

@Component({
  selector: "app-collection-detail",
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    MatIconModule,
    SkeletonLoaderComponent,
    FormatBytesPipe,
    SortableHeaderComponent,
    DataTypeBadgeComponent,
    PageContainerComponent,
    ModalComponent,
  ],
  templateUrl: "./collection-detail.component.html",
})
export class CollectionDetailComponent implements OnInit {
  collectionName = "";
  schema = signal<{ name: string; columns: FieldInfo[]; indexes: IndexInfo[] } | null>(null);
  stats = signal<{
    name: string;
    document_count: number;
    size_bytes: number;
    index_count: number;
  } | null>(null);
  loading = signal(false);
  error = signal("");

  sortColumn = signal<string>("name");
  sortDirection = signal<"asc" | "desc">("asc");

  showAddFieldModal = signal(false);
  showCreateIndexModal = signal(false);
  newField = { name: "", data_type: "string", nullable: true, default_value: "", description: "" };
  newIndex = { name: "", columns: [] as string[], is_unique: false };

  editingField = signal<string | null>(null);
  editFieldValue = "";

  deletingField = signal<string | null>(null);
  deletingIndex = signal<string | null>(null);
  showDeleteCollectionConfirm = signal(false);

  private db = inject(DatabaseService);
  private toast = inject(ToastService);
  private exportService = inject(ExportService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  async ngOnInit() {
    this.collectionName = this.route.snapshot.paramMap.get("collection") || "";
    await this.loadDetails();
  }

  async loadDetails() {
    this.loading.set(true);
    this.error.set("");
    try {
      const [schema, stats] = await Promise.all([
        this.db.describeCollection(this.collectionName),
        this.db.getCollectionStats(this.collectionName),
      ]);
      this.schema.set(schema);
      this.stats.set(stats);
    } catch (e: any) {
      this.error.set(e.message || "Failed to load collection details");
      this.toast.error(this.error());
    } finally {
      this.loading.set(false);
    }
  }

  sortedFields(): FieldInfo[] {
    const fields = this.schema()?.columns || [];
    const col = this.sortColumn();
    const dir = this.sortDirection();

    return [...fields].sort((a, b) => {
      const aVal = a[col as keyof FieldInfo] ?? "";
      const bVal = b[col as keyof FieldInfo] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return dir === "asc" ? cmp : -cmp;
    });
  }

  onSortChange(event: { column: string; direction: "asc" | "desc" }) {
    this.sortColumn.set(event.column);
    this.sortDirection.set(event.direction);
  }

  openAddFieldModal() {
    this.newField = {
      name: "",
      data_type: "string",
      nullable: true,
      default_value: "",
      description: "",
    };
    this.showAddFieldModal.set(true);
  }

  closeAddFieldModal() {
    this.showAddFieldModal.set(false);
  }

  async addField() {
    if (!this.newField.name.trim()) {
      this.toast.warning("Field name is required");
      return;
    }
    // TODO: Backend API needed - db.addField(this.collectionName, this.newField)
    this.toast.info("Add field functionality requires backend support");
    this.closeAddFieldModal();
  }

  startEditField(field: FieldInfo) {
    this.editingField.set(field.name);
    this.editFieldValue = field.description || "";
  }

  saveEditField(field: FieldInfo) {
    field.description = this.editFieldValue;
    this.editingField.set(null);
    this.schema.update((s) => s);
    this.toast.success(`Field "${field.name}" updated`);
  }

  cancelEditField() {
    this.editingField.set(null);
  }

  confirmDeleteField(field: FieldInfo) {
    this.deletingField.set(field.name);
  }

  async deleteField() {
    const fieldName = this.deletingField();
    if (!fieldName) return;
    // TODO: Backend API needed - db.deleteField(this.collectionName, fieldName)
    this.toast.info("Delete field functionality requires backend support");
    this.deletingField.set(null);
  }

  cancelDeleteField() {
    this.deletingField.set(null);
  }

  openCreateIndexModal() {
    this.newIndex = { name: "", columns: [], is_unique: false };
    this.showCreateIndexModal.set(true);
  }

  closeCreateIndexModal() {
    this.showCreateIndexModal.set(false);
  }

  async createIndex() {
    if (!this.newIndex.name.trim()) {
      this.toast.warning("Index name is required");
      return;
    }
    if (this.newIndex.columns.length === 0) {
      this.toast.warning("Select at least one column");
      return;
    }
    // TODO: Backend API needed - db.createIndex(this.collectionName, this.newIndex)
    this.toast.info("Create index functionality requires backend support");
    this.closeCreateIndexModal();
  }

  toggleIndexColumn(colName: string) {
    if (this.newIndex.columns.includes(colName)) {
      this.newIndex.columns = this.newIndex.columns.filter((c) => c !== colName);
    } else {
      this.newIndex.columns = [...this.newIndex.columns, colName];
    }
  }

  confirmDeleteIndex(index: IndexInfo) {
    this.deletingIndex.set(index.name);
  }

  async deleteIndex() {
    const indexName = this.deletingIndex();
    if (!indexName) return;
    // TODO: Backend API needed - db.deleteIndex(this.collectionName, indexName)
    this.toast.info("Delete index functionality requires backend support");
    this.deletingIndex.set(null);
  }

  cancelDeleteIndex() {
    this.deletingIndex.set(null);
  }

  viewData() {
    this.router.navigate(["/data", this.collectionName]);
  }

  exportSchema(format: "json" | "csv") {
    const data = {
      name: this.collectionName,
      fields: this.schema()?.columns || [],
      indexes: this.schema()?.indexes || [],
    };

    if (format === "json") {
      this.exportService.export({ format: "json", filename: `${this.collectionName}_schema` }, [
        data,
      ]);
    } else {
      this.exportService.export(
        { format: "csv", filename: `${this.collectionName}_schema`, includeHeaders: true },
        data.fields.map((f) => ({
          name: f.name,
          type: f.data_type,
          nullable: f.nullable,
          primary_key: f.is_primary_key,
          default: f.default_value ?? "",
          description: f.description ?? "",
        }))
      );
    }
  }

  openDeleteCollectionConfirm() {
    this.showDeleteCollectionConfirm.set(true);
  }

  async deleteCollection() {
    if (!confirm(`Delete collection "${this.collectionName}"? This cannot be undone.`)) {
      this.showDeleteCollectionConfirm.set(false);
      return;
    }
    try {
      await this.db.dropCollection(this.collectionName);
      this.toast.success(`Collection "${this.collectionName}" deleted`);
      this.router.navigate(["/schema"]);
    } catch (e: any) {
      this.toast.error(e.message || "Failed to delete collection");
      this.showDeleteCollectionConfirm.set(false);
    }
  }

  cancelDeleteCollection() {
    this.showDeleteCollectionConfirm.set(false);
  }
}
