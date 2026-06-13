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
import { LoggingService } from "@shared/services/logging.service";

@Component({
  selector: "app-query-condition",
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: "./query-condition.component.html",
})
export class QueryConditionComponent implements OnInit {
  private readonly schemaCompletion = inject(SchemaCompletionService);
  private readonly logger = inject(LoggingService);

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
    this.logger.debug("[QUERY]", "Condition field changed", { field });
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
