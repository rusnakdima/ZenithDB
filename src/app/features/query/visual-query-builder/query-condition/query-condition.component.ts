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
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import {
  Condition,
  FieldInfo,
  FieldType,
  FIELD_OPERATORS,
  OPERATOR_LABELS,
  createEmptyCondition,
} from "../../models";
import { SchemaCompletionService } from "../../services";

@Component({
  selector: "app-query-condition",
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div
      class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2"
    >
      <!-- Field Selector -->
      <select
        class="min-w-[120px] rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
        [ngModel]="condition.field"
        (ngModelChange)="onFieldChange($event)"
      >
        <option value="">Field...</option>
        @for (field of fields(); track field.name) {
          <option [value]="field.name">{{ field.name }}</option>
        }
      </select>

      <!-- Operator Selector -->
      <select
        class="min-w-[140px] rounded border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
        [ngModel]="condition.operator"
        (ngModelChange)="onOperatorChange($event)"
      >
        @for (op of availableOperators(); track op) {
          <option [value]="op">{{ getOperatorLabel(op) }}</option>
        }
      </select>

      <!-- Value Input -->
      @if (!isNullOperator()) {
        <input
          type="text"
          class="flex-1 rounded border border-slate-600 bg-slate-700 px-3 py-1.5 font-mono text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
          placeholder="Value..."
          [ngModel]="condition.value"
          (ngModelChange)="onValueChange($event)"
          (focus)="onValueFocus()"
          (blur)="onValueBlur()"
        />
      } @else {
        <span class="flex-1 px-3 text-sm text-slate-500 italic">
          {{ condition.operator === "isNull" ? "is null" : "is not null" }}
        </span>
      }

      <!-- Remove Button -->
      <button
        type="button"
        class="rounded p-1 text-slate-400 transition-colors hover:text-red-400"
        (click)="onRemove()"
        title="Remove condition"
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
  `,
})
export class QueryConditionComponent implements OnInit {
  private readonly schemaCompletion = inject(SchemaCompletionService);

  @Input() condition!: Condition;
  @Input() collectionName = "";
  @Output() conditionChange = new EventEmitter<Condition>();
  @Output() remove = new EventEmitter<void>();
  @Output() fieldFocus = new EventEmitter<void>();

  fields = signal<FieldInfo[]>([]);

  availableOperators = computed(() => {
    const fieldName = this.condition.field;
    const fieldType = this.condition.valueType;

    if (fieldName) {
      const field = this.fields().find((f) => f.name === fieldName);
      if (field) {
        return FIELD_OPERATORS[field.type] || FIELD_OPERATORS["string"];
      }
    }

    return FIELD_OPERATORS["string"];
  });

  isNullOperator = computed(() => {
    const op = this.condition.operator;
    return op === "isNull" || op === "isNotNull";
  });

  ngOnInit(): void {
    this.loadFields();
  }

  private async loadFields(): Promise<void> {
    if (this.collectionName) {
      const fields = await this.schemaCompletion.getFields(this.collectionName);
      this.fields.set(fields);
    }
  }

  onFieldChange(field: string): void {
    const fieldInfo = this.fields().find((f) => f.name === field);
    const newType = fieldInfo?.type ?? "string";
    const operators = FIELD_OPERATORS[newType] || FIELD_OPERATORS["string"];

    this.conditionChange.emit({
      ...this.condition,
      field,
      valueType: newType,
      operator: operators[0],
      value: "",
    });
  }

  onOperatorChange(operator: string): void {
    this.conditionChange.emit({
      ...this.condition,
      operator: operator as any,
    });
  }

  onValueChange(value: string): void {
    let parsedValue: unknown = value;

    if (value === "true") parsedValue = true;
    else if (value === "false") parsedValue = false;
    else if (value === "null") parsedValue = null;
    else if (!isNaN(Number(value)) && value !== "") parsedValue = Number(value);

    this.conditionChange.emit({
      ...this.condition,
      value: parsedValue,
    });
  }

  onValueFocus(): void {
    this.fieldFocus.emit();
  }

  onValueBlur(): void {}

  onRemove(): void {
    this.remove.emit();
  }

  getOperatorLabel(op: string): string {
    return OPERATOR_LABELS[op as keyof typeof OPERATOR_LABELS] || op;
  }
}
