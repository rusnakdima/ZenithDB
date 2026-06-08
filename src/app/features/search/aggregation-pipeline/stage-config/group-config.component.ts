import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { GroupConfig, GroupAccumulator } from "../pipeline-builder.service";
import { SchemaCompletionService } from "../../../query/services/schema-completion.service";
import { FieldInfo } from "../../../query/models";

@Component({
  selector: "app-group-config",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-4">
      <div class="space-y-2">
        <label class="text-xs tracking-wide text-slate-400 uppercase">Group By Field</label>
        <select
          class="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-200 focus:border-[var(--accent)] focus:outline-none"
          [ngModel]="config.groupByField"
          (ngModelChange)="onGroupByChange($event)"
        >
          <option value="">Select field...</option>
          @for (field of fields(); track field.name) {
            <option [value]="field.name">{{ field.name }} ({{ field.type }})</option>
          }
        </select>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-xs tracking-wide text-slate-400 uppercase">Accumulators</label>
          <button
            type="button"
            class="text-xs text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
            (click)="addAccumulator()"
          >
            + Add accumulator
          </button>
        </div>

        @if (config.accumulators.length === 0) {
          <div
            class="rounded border border-dashed border-slate-600 p-4 text-center text-xs text-slate-500"
          >
            No accumulators defined. Click "Add accumulator" to add one.
          </div>
        }

        <div class="space-y-2">
          @for (acc of config.accumulators; track acc.id; let i = $index) {
            <div
              class="flex items-center gap-2 rounded border border-slate-600 bg-slate-800/30 p-2"
            >
              <input
                type="text"
                class="flex-1 rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-slate-200 focus:border-[var(--accent)] focus:outline-none"
                placeholder="Output field name"
                [ngModel]="acc.field"
                (ngModelChange)="updateAccumulatorField(i, $event)"
              />

              <select
                class="rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-slate-200 focus:border-[var(--accent)] focus:outline-none"
                [ngModel]="acc.operator"
                (ngModelChange)="updateAccumulatorOperator(i, $event)"
              >
                <option value="sum">Sum</option>
                <option value="avg">Avg</option>
                <option value="min">Min</option>
                <option value="max">Max</option>
                <option value="count">Count</option>
                <option value="push">Push</option>
                <option value="addToSet">Add to Set</option>
              </select>

              @if (acc.operator !== "count") {
                <select
                  class="rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-slate-200 focus:border-[var(--accent)] focus:outline-none"
                  [ngModel]="acc.value"
                  (ngModelChange)="updateAccumulatorValue(i, $event)"
                >
                  <option value="">Select field...</option>
                  @for (field of fields(); track field.name) {
                    <option [value]="field.name">{{ field.name }}</option>
                  }
                </select>
              }

              <button
                type="button"
                class="p-1 text-slate-500 hover:text-red-400"
                (click)="removeAccumulator(i)"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class GroupConfigComponent implements OnInit {
  private readonly schemaCompletion = inject(SchemaCompletionService);

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
    this.configChange.emit({
      ...this.config,
      accumulators: this.config.accumulators.filter((_, i) => i !== index),
    });
  }
}
