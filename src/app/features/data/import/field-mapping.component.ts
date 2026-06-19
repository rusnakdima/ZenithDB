import { Component, input, output, signal, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FieldMapping } from "./import.service";
import { logger } from "@core/services/logger.service";

interface MappingOption {
  sourceField: string;
  targetField: string;
}

@Component({
  selector: "app-field-mapping",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./field-mapping.component.html",
})
export class FieldMappingComponent {
  sourceHeaders = input<string[]>([]);
  targetFields = input<string[]>([]);
  mappings = input<FieldMapping[]>([]);

  mappingsChange = output<FieldMapping[]>();

  draggedSource = signal<string | null>(null);
  draggedTarget = signal<string | null>(null);

  mappingOptions = computed<MappingOption[]>(() => {
    const sources = this.sourceHeaders();
    const targets = this.targetFields();
    const currentMappings = this.mappings();

    return sources.map((source) => {
      const existing = currentMappings.find((m) => m.sourceField === source);
      return {
        sourceField: source,
        targetField: existing?.targetField ?? "",
      };
    });
  });

  unmappedSources = computed(() => {
    const mapped = this.mappings().map((m) => m.sourceField);
    return this.sourceHeaders().filter((h) => !mapped.includes(h));
  });

  unmappedTargets = computed(() => {
    const mapped = this.mappings().map((m) => m.targetField);
    return this.targetFields().filter((f) => !mapped.includes(f));
  });

  onSourceDragStart(header: string): void {
    this.draggedSource.set(header);
  }

  onSourceDragEnd(): void {
    this.draggedSource.set(null);
  }

  onTargetDragStart(field: string): void {
    this.draggedTarget.set(field);
  }

  onTargetDragEnd(): void {
    this.draggedTarget.set(null);
  }

  onDropToSource(header: string): void {
    const targetField = this.draggedTarget();
    if (targetField) {
      this.updateMapping(header, targetField);
    }
    this.draggedTarget.set(null);
  }

  onDropToTarget(field: string): void {
    const sourceField = this.draggedSource();
    if (sourceField) {
      this.updateMapping(sourceField, field);
    }
    this.draggedSource.set(null);
  }

  onMappingChange(index: number, targetField: string): void {
    const currentMappings = [...this.mappings()];
    currentMappings[index] = {
      ...currentMappings[index],
      targetField,
    };
    this.mappingsChange.emit(currentMappings);
  }

  private updateMapping(sourceField: string, targetField: string): void {
    const currentMappings = [...this.mappings()];
    const existingIndex = currentMappings.findIndex((m) => m.sourceField === sourceField);

    if (existingIndex >= 0) {
      currentMappings[existingIndex] = { sourceField, targetField };
    } else {
      currentMappings.push({ sourceField, targetField });
    }

    this.mappingsChange.emit(currentMappings);
  }

  removeMapping(sourceField: string): void {
    const currentMappings = this.mappings().filter((m) => m.sourceField !== sourceField);
    this.mappingsChange.emit(currentMappings);
  }

  autoMap(): void {
    const sources = this.sourceHeaders();
    const targets = this.targetFields();
    const newMappings: FieldMapping[] = [];

    for (const source of sources) {
      const normalizedSource = source.toLowerCase().replace(/[_\s-]/g, "");
      const matchingTarget = targets.find(
        (target) =>
          target.toLowerCase().replace(/[_\s-]/g, "") === normalizedSource ||
          target.toLowerCase() === source.toLowerCase()
      );

      if (matchingTarget) {
        newMappings.push({ sourceField: source, targetField: matchingTarget });
      }
    }

    logger.debug("[DATA_IMPORT]", `Auto-mapped ${newMappings.length} fields`, {
      count: newMappings.length,
    });
    this.mappingsChange.emit(newMappings);
  }

  clearMappings(): void {
    this.mappingsChange.emit([]);
  }
}
