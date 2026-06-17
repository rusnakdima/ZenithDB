import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ModalComponent } from "@shared/components/modal/modal.component";
import { FieldInfo } from "../../query/models";
import { FieldWeight } from "./fulltext-search.component";
import { logger } from "../../../services/logger.service";

export interface TextIndexConfig {
  fields: FieldWeight[];
  indexName?: string;
}

@Component({
  selector: "app-text-index-dialog",
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: "./text-index-dialog.component.html",
})
export class TextIndexDialogComponent implements OnInit {
  

  @Input() collectionName: string = "";
  @Input() fields: FieldInfo[] = [];
  @Input() existingWeights: FieldWeight[] = [];

  @Output() indexCreated = new EventEmitter<FieldWeight[]>();
  @Output() close = new EventEmitter<void>();

  isOpen = signal(true);
  title = signal("Create Text Index");
  size = signal<"md">("md");

  fieldWeights = signal<FieldWeight[]>([]);
  indexName = signal("");

  activeFieldWeightsCount = computed(() => {
    return this.fieldWeights().filter((w) => w.weight > 0).length;
  });

  ngOnInit(): void {
    logger.debug("[SEARCH_FULLTEXT]", "Text index dialog initialized", {
      collectionName: this.collectionName,
      fieldCount: this.fields.length,
      hasExistingWeights: this.existingWeights.length > 0,
    });
    if (this.existingWeights.length > 0) {
      this.fieldWeights.set([...this.existingWeights]);
      this.indexName.set(`${this.collectionName}_text_idx`);
    } else {
      const weights: FieldWeight[] = this.fields
        .filter((f) => f.type === "string")
        .map((f) => ({ field: f.name, weight: 1 }));
      this.fieldWeights.set(weights);
    }
  }

  updateWeight(field: string, weight: number): void {
    const clampedWeight = Math.max(0, Math.min(10, weight));
    this.fieldWeights.update((weights) =>
      weights.map((w) => (w.field === field ? { ...w, weight: clampedWeight } : w))
    );
  }

  getPreview(): string {
    const activeFields = this.fieldWeights()
      .filter((w) => w.weight > 0)
      .map((w) => `${w.field}:${w.weight}`);

    if (activeFields.length === 0) {
      return "No fields selected for indexing";
    }

    return `Text Index: ${this.collectionName}\nFields: ${activeFields.join(", ")}`;
  }

  onCreate(): void {
    const weights = this.fieldWeights().filter((w) => w.weight > 0);
    if (weights.length === 0) {
      return;
    }
    logger.info("[SEARCH_FULLTEXT]", "Creating text index", {
      collectionName: this.collectionName,
      indexName: this.indexName(),
      fieldWeights: weights,
    });
    this.indexCreated.emit(weights);
    this.onClose();
  }

  onClose(): void {
    this.isOpen.set(false);
    this.close.emit();
  }

  onClosed(): void {
    this.isOpen.set(false);
  }

  onOpened(): void {
    this.isOpen.set(true);
  }

  get totalWeight(): number {
    return this.fieldWeights().reduce((sum, w) => sum + w.weight, 0);
  }
}
