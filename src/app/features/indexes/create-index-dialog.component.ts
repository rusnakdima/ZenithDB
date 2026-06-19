import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { IndexTypeSelectorComponent } from "./index-type-selector.component";
import { FieldSelectorComponent } from "./field-selector.component";
import { IndexOptionsComponent } from "./index-options.component";
import { IndexService, IndexDefinition, IndexField, IndexOptions } from "./index.service";
import { SchemaCompletionService } from "@features/query/services";
import { FieldInfo } from "@features/query/models";
import { ToastService } from "@services/toast.service";
import { logger } from "@core/services/logger.service";

export type IndexType = "single" | "compound" | "text" | "geospatial" | "ttl" | "hashed";

@Component({
  selector: "app-create-index-dialog",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ModalComponent,
    IndexTypeSelectorComponent,
    FieldSelectorComponent,
    IndexOptionsComponent,
  ],
  templateUrl: "./create-index-dialog.component.html",
})
export class CreateIndexDialogComponent implements OnInit {
  private readonly indexService = inject(IndexService);
  private readonly schemaCompletion = inject(SchemaCompletionService);
  private readonly toast = inject(ToastService);

  @Input() collectionName = "";

  @Output() closed = new EventEmitter<void>();
  @Output() create = new EventEmitter<IndexDefinition>();

  indexType = signal<IndexType>("single");
  selectedFields = signal<IndexField[]>([]);
  indexName = signal("");
  options = signal<IndexOptions>({});
  availableFields = signal<FieldInfo[]>([]);

  ngOnInit(): void {
    this.loadFields();
  }

  private async loadFields(): Promise<void> {
    const fields = await this.schemaCompletion.getFields(this.collectionName);
    this.availableFields.set(fields);
  }

  onIndexTypeChange(type: IndexType): void {
    logger.debug("[INDEX]", "Index type changing", { type });
    this.indexType.set(type);
  }

  onFieldsChange(fields: IndexField[]): void {
    logger.debug("[INDEX]", "Fields changing for index", { count: fields.length });
    this.selectedFields.set(fields);
    this.updateIndexName();
  }

  onOptionsChange(options: IndexOptions): void {
    this.options.set(options);
  }

  private updateIndexName(): void {
    const fields = this.selectedFields();
    if (fields.length > 0) {
      const name = this.indexService.generateIndexName(
        this.collectionName,
        fields.map((f) => f.name)
      );
      this.indexName.set(name);
    }
  }

  onIndexNameChange(name: string): void {
    this.indexName.set(name);
  }

  get previewDefinition(): IndexDefinition {
    return {
      name: this.indexName() || "unnamed_index",
      type: this.indexType(),
      fields: this.selectedFields(),
      options: this.options(),
    };
  }

  onCancel(): void {
    logger.debug("[INDEX]", "Create index dialog cancelled");
    this.closed.emit();
  }

  onCreate(): void {
    const fields = this.selectedFields();
    if (fields.length === 0) {
      this.toast.error("Please select at least one field");
      return;
    }

    const name = this.indexName().trim();
    if (!name) {
      this.toast.error("Please enter an index name");
      return;
    }

    logger.info("[INDEX]", "Creating index", {
      name,
      type: this.indexType(),
      collection: this.collectionName,
    });
    const indexDef: IndexDefinition = {
      name,
      type: this.indexType(),
      fields,
      options: this.options(),
    };

    this.create.emit(indexDef);
  }
}
