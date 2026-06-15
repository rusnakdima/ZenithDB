import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { GroupConfig, GroupAccumulator } from "../pipeline-builder.service";
import { SchemaCompletionService } from "../../../query/services/schema-completion.service";
import { FieldInfo } from "../../../query/models";
import { getLoggingService } from "@tauri-apps/logger";

@Component({
  selector: "app-group-config",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./group-config.component.html",
})
export class GroupConfigComponent implements OnInit {
  private readonly schemaCompletion = inject(SchemaCompletionService);
  private logger = getLoggingService();

  @Input() config!: GroupConfig;
  @Input() collectionName = "";
  @Output() configChange = new EventEmitter<GroupConfig>();

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

  onGroupByChange(field: string): void {
    this.logger.debug("[SEARCH_PIPELINE]", "Group config groupBy field changed", { field });
    this.configChange.emit({
      ...this.config,
      groupByField: field,
    });
  }

  addAccumulator(): void {
    const newAcc: GroupAccumulator = {
      id: crypto.randomUUID(),
      field: "",
      operator: "sum",
      value: "",
    };
    this.logger.debug("[SEARCH_PIPELINE]", "Group accumulator added");
    this.configChange.emit({
      ...this.config,
      accumulators: [...this.config.accumulators, newAcc],
    });
  }

  updateAccumulatorField(index: number, field: string): void {
    const accumulators = [...this.config.accumulators];
    accumulators[index] = { ...accumulators[index], field };
    this.configChange.emit({ ...this.config, accumulators });
  }

  updateAccumulatorOperator(index: number, operator: GroupAccumulator["operator"]): void {
    const accumulators = [...this.config.accumulators];
    accumulators[index] = { ...accumulators[index], operator };
    this.configChange.emit({ ...this.config, accumulators });
  }

  updateAccumulatorValue(index: number, value: string): void {
    const accumulators = [...this.config.accumulators];
    accumulators[index] = { ...accumulators[index], value };
    this.configChange.emit({ ...this.config, accumulators });
  }

  removeAccumulator(index: number): void {
    this.logger.debug("[SEARCH_PIPELINE]", "Group accumulator removed", { index });
    this.configChange.emit({
      ...this.config,
      accumulators: this.config.accumulators.filter((_, i) => i !== index),
    });
  }
}
