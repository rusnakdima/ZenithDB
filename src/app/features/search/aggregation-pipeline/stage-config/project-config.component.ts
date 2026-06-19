import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ProjectConfig, ProjectField } from "../pipeline-builder.service";
import { SchemaCompletionService } from "../../../query/services/schema-completion.service";
import { FieldInfo } from "../../../query/models";
@Component({
  selector: "app-project-config",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./project-config.component.html",
})
export class ProjectConfigComponent implements OnInit {
  private readonly schemaCompletion = inject(SchemaCompletionService);

  @Input() config!: ProjectConfig;
  @Input() collectionName = "";
  @Output() configChange = new EventEmitter<ProjectConfig>();

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

  addField(): void {
    const newField: ProjectField = { name: "", include: true };
    this.configChange.emit({
      ...this.config,
      fields: [...this.config.fields, newField],
    });
  }

  updateFieldName(index: number, name: string): void {
    const fields = [...this.config.fields];
    fields[index] = { ...fields[index], name };
    this.configChange.emit({ ...this.config, fields });
  }

  updateFieldInclude(index: number, include: boolean): void {
    const fields = [...this.config.fields];
    fields[index] = { ...fields[index], include };
    this.configChange.emit({ ...this.config, fields });
  }

  updateFieldExpression(index: number, expression: string): void {
    const fields = [...this.config.fields];
    fields[index] = { ...fields[index], expression };
    this.configChange.emit({ ...this.config, fields });
  }

  removeField(index: number): void {
    this.configChange.emit({
      ...this.config,
      fields: this.config.fields.filter((_, i) => i !== index),
    });
  }

  includeAllFields(): void {
    const allFields = this.fields().map((f) => ({
      name: f.name,
      include: true,
    }));
    this.configChange.emit({
      ...this.config,
      fields: allFields,
    });
  }

  excludeAllFields(): void {
    const allFields = this.fields().map((f) => ({
      name: f.name,
      include: false,
    }));
    this.configChange.emit({
      ...this.config,
      fields: allFields,
    });
  }
}
