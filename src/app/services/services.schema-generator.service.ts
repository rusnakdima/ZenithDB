import { Injectable, inject } from "@angular/core";
import { TauriApiService } from "@app/api/api.api.service";
import { CollectionSchema, ColumnInfo } from "@entities/entities.connection.config";

export interface UISchema {
  id: string;
  name: string;
  version?: string;
  pages: PageSchema[];
  components: ComponentSchema[];
  sharedComponents?: string[];
  i18n?: Record<string, Record<string, string>>;
}

export interface PageSchema {
  id: string;
  name: string;
  route: string;
  elements: CanvasElement[];
}

export interface ComponentSchema {
  id: string;
  name: string;
  type: string;
  props: Record<string, unknown>;
}

export interface CanvasElement {
  id: string;
  componentId: string;
  name: string;
  gridPosition: {
    column: number;
    row: number;
    colSpan: number;
    rowSpan: number;
  };
  props: Record<string, unknown>;
}

export interface SchemaGeneratorOptions {
  collectionName: string;
  collectionSchema: CollectionSchema;
  generateList: boolean;
  generateDetail: boolean;
}

@Injectable({ providedIn: "root" })
export class SchemaGeneratorService {
  private api = inject(TauriApiService);

  generateSchema(options: SchemaGeneratorOptions): UISchema {
    const { collectionName, collectionSchema, generateList, generateDetail } = options;
    const pages: PageSchema[] = [];
    const components: ComponentSchema[] = [];

    if (generateList) {
      const listPage = this.generateListPage(collectionName, collectionSchema);
      pages.push(listPage);
    }

    if (generateDetail) {
      const detailPage = this.generateDetailPage(collectionName, collectionSchema);
      pages.push(detailPage);
    }

    return {
      id: `${collectionName}-ui-schema`,
      name: `${collectionSchema.name} UI Schema`,
      version: "1.0.0",
      pages,
      components,
    };
  }

  private generateListPage(name: string, schema: CollectionSchema): PageSchema {
    const tableColumns = schema.columns
      .filter((col) => !col.is_primary_key || col.name !== "_id")
      .map((col, idx) => this.columnToTableColumn(col, idx));

    return {
      id: `${name}-list`,
      name: `${name} List`,
      route: `/${name}`,
      elements: [
        {
          id: `${name}-table`,
          componentId: "data-table",
          name: `${name} Table`,
          gridPosition: { column: 1, row: 1, colSpan: 12, rowSpan: 1 },
          props: {
            columns: tableColumns,
            entityName: name,
          },
        },
      ],
    };
  }

  private generateDetailPage(name: string, schema: CollectionSchema): PageSchema {
    const formFields = schema.columns
      .filter((col) => !col.is_primary_key || col.name !== "_id")
      .map((col, idx) => this.columnToFormField(col, idx));

    return {
      id: `${name}-detail`,
      name: `${name} Detail`,
      route: `/${name}/:id`,
      elements: [
        {
          id: `${name}-form`,
          componentId: "ui-form",
          name: `${name} Form`,
          gridPosition: { column: 1, row: 1, colSpan: 6, rowSpan: 1 },
          props: {
            fields: formFields,
            entityName: name,
          },
        },
      ],
    };
  }

  private columnToTableColumn(col: ColumnInfo, idx: number): Record<string, unknown> {
    return {
      field: col.name,
      header: this.formatHeader(col.name),
      type: this.mapColumnType(col.data_type),
      sortable: true,
      filterable: true,
    };
  }

  private columnToFormField(col: ColumnInfo, idx: number): Record<string, unknown> {
    const inputType = this.getInputType(col.data_type);
    return {
      name: col.name,
      label: this.formatHeader(col.name),
      type: inputType,
      required: !col.nullable,
      placeholder: `Enter ${col.name}`,
    };
  }

  private formatHeader(name: string): string {
    return name
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (str) => str.toUpperCase());
  }

  private mapColumnType(dataType: string): string {
    const typeMap: Record<string, string> = {
      string: "text",
      text: "text",
      int: "number",
      integer: "number",
      float: "number",
      double: "number",
      decimal: "number",
      boolean: "boolean",
      bool: "boolean",
      date: "date",
      datetime: "datetime",
      timestamp: "datetime",
      object: "object",
      array: "array",
    };
    return typeMap[dataType.toLowerCase()] || "text";
  }

  private getInputType(dataType: string): string {
    const typeMap: Record<string, string> = {
      string: "text",
      text: "textarea",
      int: "number",
      integer: "number",
      float: "number",
      double: "number",
      decimal: "number",
      boolean: "checkbox",
      bool: "checkbox",
      date: "date",
      datetime: "datetime-local",
      timestamp: "datetime-local",
    };
    return typeMap[dataType.toLowerCase()] || "text";
  }

  async saveSchema(schema: UISchema): Promise<void> {
    return this.api.invoke("save_ui_schema", { schema });
  }

  async loadSchema(id: string): Promise<UISchema | null> {
    return this.api.invoke<UISchema | null>("load_ui_schema", { id });
  }

  async listSchemas(): Promise<UISchema[]> {
    return this.api.invoke<UISchema[]>("list_ui_schemas");
  }

  async deleteSchema(id: string): Promise<void> {
    return this.api.invoke("delete_ui_schema", { id });
  }
}
