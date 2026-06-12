import { Component, signal, inject, output, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ModalComponent } from "@shared/components/modal/modal.component";
import {
  ImportService,
  ParsedData,
  FieldMapping,
  ImportOptions,
  ImportProgress,
} from "./import.service";
import { SchemaCompletionService } from "@features/query/services/schema-completion.service";
import { FieldMappingComponent } from "./field-mapping.component";
import { ToastService } from "@services/toast.service";
import { AppLoggerService } from "@shared/services/app-logger.service";

@Component({
  selector: "app-import-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, FieldMappingComponent],
  templateUrl: "./import-dialog.component.html",
})
export class ImportDialogComponent implements OnInit {
  private importService = inject(ImportService);
  private schemaCompletion = inject(SchemaCompletionService);
  private toast = inject(ToastService);
  private logger = inject(AppLoggerService);

  closed = output<void>();

  isOpen = signal(true);
  selectedFile = signal<File | null>(null);
  parsedData = signal<ParsedData | null>(null);
  collections = signal<string[]>([]);
  selectedCollection = signal("");
  mappings = signal<FieldMapping[]>([]);
  updateExisting = signal(false);
  batchSize = signal(100);
  isImporting = signal(false);
  importProgress = signal<ImportProgress | null>(null);
  targetFields = signal<string[]>([]);
  validationErrors = signal<Map<number, string>>(new Map());

  dragOver = signal(false);

  ngOnInit(): void {
    this.loadCollections();
  }

  private async loadCollections(): Promise<void> {
    const cols = await this.schemaCompletion.getCollections();
    this.collections.set(cols);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private async handleFile(file: File): Promise<void> {
    const validExtensions = ["csv", "json", "jsonl", "ndjson"];
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !validExtensions.includes(extension)) {
      this.toast.error(`Invalid file format. Supported: ${validExtensions.join(", ")}`);
      return;
    }

    this.selectedFile.set(file);

    try {
      const parsed = await this.importService.parseFile(file);
      this.parsedData.set(parsed);
      this.validateData();
    } catch (e) {
      this.toast.error(`Failed to parse file: ${(e as Error).message}`);
      this.selectedFile.set(null);
    }
  }

  onCollectionChange(collection: string): void {
    this.selectedCollection.set(collection);
    this.loadTargetFields(collection);
  }

  private async loadTargetFields(collection: string): Promise<void> {
    const fields = await this.schemaCompletion.getFields(collection);
    this.targetFields.set(fields.map((f) => f.name));
  }

  onMappingsChange(mappings: FieldMapping[]): void {
    this.mappings.set(mappings);
    this.validateData();
  }

  private validateData(): void {
    const errors = new Map<number, string>();
    const data = this.parsedData();
    const mappingList = this.mappings();

    if (!data || mappingList.length === 0) return;

    data.rows.forEach((row, idx) => {
      for (const mapping of mappingList) {
        if (row[mapping.sourceField] === undefined || row[mapping.sourceField] === null) {
          errors.set(idx, `Missing value for ${mapping.sourceField}`);
        }
      }
    });

    this.validationErrors.set(errors);
  }

  onBatchSizeChange(size: number): void {
    this.batchSize.set(Math.max(1, Math.min(1000, size)));
  }

  get previewRows(): Record<string, unknown>[] {
    const data = this.parsedData();
    const mappingList = this.mappings();
    if (!data || mappingList.length === 0) return [];

    return this.importService.previewMappedData(data.rows, mappingList);
  }

  get canImport(): boolean {
    return (
      this.selectedFile() !== null &&
      this.parsedData() !== null &&
      this.selectedCollection() !== "" &&
      this.mappings().length > 0 &&
      this.validationErrors().size === 0 &&
      !this.isImporting()
    );
  }

  get errorCount(): number {
    return this.validationErrors().size;
  }

  async onImport(): Promise<void> {
    const data = this.parsedData();
    const collection = this.selectedCollection();
    const mappingList = this.mappings();

    if (!data || !collection || mappingList.length === 0) return;

    this.isImporting.set(true);

    const options: ImportOptions = {
      collection,
      mappings: mappingList,
      updateExisting: this.updateExisting(),
      batchSize: this.batchSize(),
    };

    try {
      this.logger.info(
        "[DATA_IMPORT]",
        `Starting import to ${collection}: ${data.rows.length} rows`
      );
      const result = await this.importService.importData(
        collection,
        data.rows,
        options,
        (progress) => this.importProgress.set(progress)
      );

      if (result.errors.length === 0) {
        this.toast.success(
          `Successfully imported ${result.imported} rows in ${result.duration.toFixed(0)}ms`
        );
      } else {
        this.toast.warning(`Imported ${result.imported} rows with ${result.errors.length} errors`);
      }

      this.onClose();
    } catch (e) {
      this.toast.error(`Import failed: ${(e as Error).message}`);
    } finally {
      this.isImporting.set(false);
      this.importProgress.set(null);
    }
  }

  onClose(): void {
    this.isOpen.set(false);
    this.closed.emit();
  }
}
