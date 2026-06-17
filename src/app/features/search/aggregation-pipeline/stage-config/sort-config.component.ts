import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { SortStageConfig } from "../pipeline-builder.service";
import { SchemaCompletionService } from "../../../query/services/schema-completion.service";
import { FieldInfo, SortConfig } from "../../../query/models";
import { logger } from "../../../../services/logger.service";

@Component({
  selector: "app-sort-config",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./sort-config.component.html",
})
export class SortConfigComponent implements OnInit {
  private readonly schemaCompletion = inject(SchemaCompletionService);

  @Input() config!: SortStageConfig;
  @Input() collectionName = "";
  @Output() configChange = new EventEmitter<SortStageConfig>();

  fields = signal<FieldInfo[]>([]);

  ngOnInit(): void {
    this.loadFields();
  }

  private async loadFields(): Promise<void> {
    if (this.collectionName) {
      const fields = await this.schemaCompletion.getFields(this.collectionName);
      this.fields.set(fields);
    }
  }

  addSort(): void {
    const newSort: SortConfig = { field: "", direction: "asc" };
    logger.debug("[SEARCH_PIPELINE]", "Sort field added");
    this.configChange.emit({
      ...this.config,
      sorts: [...this.config.sorts, newSort],
    });
  }

  updateSortField(index: number, field: string): void {
    const sorts = [...this.config.sorts];
    sorts[index] = { ...sorts[index], field };
    this.configChange.emit({ ...this.config, sorts });
  }

  toggleDirection(index: number): void {
    const sorts = [...this.config.sorts];
    sorts[index] = {
      ...sorts[index],
      direction: sorts[index].direction === "asc" ? "desc" : "asc",
    };
    logger.debug("[SEARCH_PIPELINE]", "Sort direction toggled", { index });
    this.configChange.emit({ ...this.config, sorts });
  }

  removeSort(index: number): void {
    logger.debug("[SEARCH_PIPELINE]", "Sort field removed", { index });
    this.configChange.emit({
      ...this.config,
      sorts: this.config.sorts.filter((_, i) => i !== index),
    });
  }
}
