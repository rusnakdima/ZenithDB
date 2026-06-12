import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { ColumnInfo, RowData } from "@shared/models/connection.config";
import { isNullOrUndefined } from "@shared/utils/collection.utils";
import { AppLoggerService } from "@shared/services/app-logger.service";

@Component({
  selector: "app-record-form",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatIconModule],
  templateUrl: "./record-form.component.html",
})
export class RecordFormComponent {
  private cdr = inject(ChangeDetectorRef);
  private logger = inject(AppLoggerService);
  mode = input<"add" | "edit">("add");
  columns = input<ColumnInfo[]>([]);
  data = input<RowData | null>(null);

  saved = output<RowData>();
  cancelled = output<void>();

  formData = signal<Record<string, unknown>>({});
  errors = signal<Record<string, string>>({});
  showDeleteConfirm = signal(false);

  primaryKeyColumn = computed(() => {
    return this.columns().find((col) => col.is_primary_key);
  });

  editableColumns = computed(() => {
    return this.columns().filter((col) => !col.is_primary_key);
  });

  isEditMode = computed(() => this.mode() === "edit");

  constructor() {
    effect(
      () => {
        const existingData = this.data();
        if (existingData && this.mode() === "edit") {
          this.formData.set({ ...existingData });
        } else {
          const initial: Record<string, unknown> = {};
          this.columns().forEach((col) => {
            if (!col.is_primary_key) {
              initial[col.name] = this.getDefaultValue(col.data_type);
            }
          });
          this.formData.set(initial);
        }
      },
      { allowSignalWrites: true }
    );
  }

  private getDefaultValue(dataType: string): unknown {
    const t = dataType.toLowerCase();
    if (t === "string" || t === "text") return "";
    if (t === "number" || t === "integer" || t === "decimal" || t === "float") return null;
    if (t === "boolean") return false;
    if (t === "date" || t === "datetime" || t === "timestamp") return "";
    if (t === "object" || t === "json") return "{}";
    if (t === "array") return "[]";
    return "";
  }

  updateField(fieldName: string, value: unknown) {
    this.formData.update((data) => ({ ...data, [fieldName]: value }));
    if (this.errors()[fieldName]) {
      this.errors.update((e) => {
        const newErrors = { ...e };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  }

  validateJson(value: string, fieldName: string): boolean {
    if (!value || value.trim() === "") return true;
    try {
      JSON.parse(value);
      return true;
    } catch {
      this.errors.update((e) => ({ ...e, [fieldName]: "Invalid JSON" }));
      return false;
    }
  }

  validateField(fieldName: string, dataType: string, value: unknown): boolean {
    const col = this.columns().find((c) => c.name === fieldName);
    if (!col) return true;

    if (col.nullable && (value === null || value === undefined || value === "")) {
      return true;
    }

    const t = dataType.toLowerCase();
    if ((t === "object" || t === "json") && typeof value === "string" && value.trim() !== "") {
      return this.validateJson(value, fieldName);
    }

    if (t === "number" || t === "integer" || t === "decimal" || t === "float") {
      if (value !== null && value !== undefined && value !== "" && isNaN(Number(value))) {
        this.errors.update((e) => ({ ...e, [fieldName]: "Must be a number" }));
        return false;
      }
    }

    return true;
  }

  getInputType(dataType: string): string {
    const t = dataType.toLowerCase();
    if (t === "number" || t === "integer" || t === "decimal" || t === "float") {
      return "number";
    }
    if (t === "date" || t === "datetime" || t === "timestamp") {
      return "datetime-local";
    }
    return "text";
  }

  getFieldValue(fieldName: string): unknown {
    return this.formData()[fieldName];
  }

  getError(fieldName: string): string | null {
    return this.errors()[fieldName] || null;
  }

  isJsonField(dataType: string): boolean {
    const t = dataType.toLowerCase();
    return t === "object" || t === "json" || t === "array";
  }

  onSubmit() {
    let hasErrors = false;
    const newErrors: Record<string, string> = {};

    for (const col of this.editableColumns()) {
      const value = this.formData()[col.name];
      if (!col.nullable && (value === null || value === undefined || value === "")) {
        newErrors[col.name] = `${col.name} is required`;
        hasErrors = true;
      }
      if (!this.validateField(col.name, col.data_type, value)) {
        hasErrors = true;
      }
    }

    if (hasErrors) {
      this.errors.set(newErrors);
      return;
    }

    const result: RowData = { ...this.formData() };

    for (const [key, value] of Object.entries(result)) {
      const col = this.columns().find((c) => c.name === key);
      if (col) {
        const t = col.data_type.toLowerCase();
        if ((t === "object" || t === "json" || t === "array") && typeof value === "string") {
          if (value.trim() !== "") {
            try {
              result[key] = JSON.parse(value);
            } catch {
              result[key] = value;
            }
          }
        } else if (t === "number" || t === "integer" || t === "decimal" || t === "float") {
          if (value !== null && value !== undefined && value !== "") {
            result[key] = Number(value);
          }
        }
      }
    }

    this.logger.debug("[DATA]", `Form submitted: ${this.isEditMode() ? "edit" : "create"}`);
    this.saved.emit(result);
  }

  onCancel() {
    this.cancelled.emit();
  }

  onDeleteClick() {
    this.showDeleteConfirm.set(true);
  }

  onDeleteConfirm() {
    this.logger.info("[DATA]", "Delete confirmed in form");
    this.saved.emit({ ...this.formData(), __delete: true } as RowData);
    this.showDeleteConfirm.set(false);
  }

  onDeleteCancel() {
    this.showDeleteConfirm.set(false);
  }
}
