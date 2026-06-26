import { Injectable, inject } from "@angular/core";
import { ColumnInfo, CollectionSchema } from "@entities/entities.connection.config";
import { UISchema, PageSchema, CanvasElement, ComponentSchema } from "./schema.types";

export interface ZenithSchemaRendererOptions {
  collectionName: string;
  collectionSchema: CollectionSchema;
  includeList: boolean;
  includeDetail: boolean;
  includeCreate: boolean;
}

@Injectable({ providedIn: "root" })
export class ZenithSchemaRendererService {
  renderFromCollection(options: ZenithSchemaRendererOptions): UISchema {
    const { collectionName, collectionSchema, includeList, includeDetail, includeCreate } = options;
    const pages: PageSchema[] = [];
    const components = this.generateComponentDefs(collectionSchema);

    if (includeList) {
      pages.push(this.renderListPage(collectionSchema));
    }

    if (includeDetail) {
      pages.push(this.renderDetailPage(collectionSchema));
    }

    if (includeCreate) {
      pages.push(this.renderCreatePage(collectionSchema));
    }

    return {
      id: `${collectionName}-schema`,
      name: `${collectionName} Schema`,
      version: "1.0.0",
      pages,
      components,
      sharedComponents: [],
    };
  }

  private generateComponentDefs(schema: CollectionSchema): ComponentSchema[] {
    return schema.columns.map((col) => ({
      id: `field-${col.name}`,
      name: this.formatFieldName(col.name),
      type: this.mapToInputType(col.data_type),
      props: {
        required: !col.nullable,
        label: this.formatFieldName(col.name),
        placeholder: `Enter ${this.formatFieldName(col.name).toLowerCase()}`,
        dataType: col.data_type,
        isPrimaryKey: col.is_primary_key,
      },
    }));
  }

  private renderListPage(schema: CollectionSchema): PageSchema {
    const tableElement = this.createTableElement(schema);
    const filterElement = this.createFilterElement(schema);

    return {
      id: `${schema.name}-list`,
      name: `${schema.name} List`,
      route: `/${schema.name.toLowerCase()}`,
      elements: [filterElement, tableElement],
    };
  }

  private renderDetailPage(schema: CollectionSchema): PageSchema {
    const formElement = this.createFormElement(schema);
    const actionsElement = this.createActionsElement(schema);

    return {
      id: `${schema.name}-detail`,
      name: `${schema.name} Detail`,
      route: `/${schema.name.toLowerCase()}/:id`,
      elements: [formElement, actionsElement],
    };
  }

  private renderCreatePage(schema: CollectionSchema): PageSchema {
    const createForm = this.createFormElement(schema, true);

    return {
      id: `${schema.name}-create`,
      name: `Create ${schema.name}`,
      route: `/${schema.name.toLowerCase()}/new`,
      elements: [createForm],
    };
  }

  private createTableElement(schema: CollectionSchema): CanvasElement {
    const columns = schema.columns
      .filter((col) => !col.is_primary_key || col.name !== "_id")
      .map((col) => this.columnToTableColumn(col));

    return {
      id: `${schema.name}-table`,
      componentId: "data-table",
      name: `${schema.name} Table`,
      gridPosition: { column: 1, row: 2, colSpan: 12, rowSpan: 1 },
      props: {
        columns,
        entityName: schema.name,
        dataSource: schema.name,
        showActions: true,
        showPagination: true,
        pageSize: 20,
      },
      classes: "",
      children: [],
    };
  }

  private createFilterElement(schema: CollectionSchema): CanvasElement {
    const filterFields = schema.columns
      .filter((col) => !col.is_primary_key)
      .slice(0, 4)
      .map((col) => ({
        field: col.name,
        label: this.formatFieldName(col.name),
        type: this.mapToFilterType(col.data_type),
        placeholder: `Filter by ${this.formatFieldName(col.name).toLowerCase()}`,
      }));

    return {
      id: `${schema.name}-filters`,
      componentId: "filter-bar",
      name: `${schema.name} Filters`,
      gridPosition: { column: 1, row: 1, colSpan: 12, rowSpan: 1 },
      props: {
        fields: filterFields,
        entityName: schema.name,
      },
      classes: "",
      children: [],
    };
  }

  private createFormElement(schema: CollectionSchema, isCreate = false): CanvasElement {
    const fields = schema.columns
      .filter((col) => !col.is_primary_key || col.name === "_id")
      .map((col) => this.columnToFormField(col, isCreate));

    return {
      id: `${schema.name}-form`,
      componentId: "form",
      name: `${schema.name} Form`,
      gridPosition: { column: 1, row: 1, colSpan: isCreate ? 8 : 6, rowSpan: 1 },
      props: {
        fields,
        entityName: schema.name,
        mode: isCreate ? "create" : "edit",
      },
      classes: "",
      children: [],
    };
  }

  private createActionsElement(schema: CollectionSchema): CanvasElement {
    return {
      id: `${schema.name}-actions`,
      componentId: "action-bar",
      name: `${schema.name} Actions`,
      gridPosition: { column: 1, row: 2, colSpan: 12, rowSpan: 1 },
      props: {
        entityName: schema.name,
        showSave: true,
        showDelete: !schema.name.toLowerCase().includes("user"),
        showCancel: true,
      },
      classes: "",
      children: [],
    };
  }

  private columnToTableColumn(col: ColumnInfo): Record<string, unknown> {
    return {
      field: col.name,
      header: this.formatFieldName(col.name),
      type: this.mapColumnType(col.data_type),
      sortable: true,
      filterable: !col.is_primary_key,
      width: this.getColumnWidth(col.data_type),
    };
  }

  private columnToFormField(col: ColumnInfo, isCreate: boolean): Record<string, unknown> {
    const inputType = this.mapToInputType(col.data_type);
    const isReadOnly = !isCreate && col.is_primary_key;

    return {
      name: col.name,
      label: this.formatFieldName(col.name),
      type: inputType,
      required: isCreate && !col.nullable,
      readonly: isReadOnly,
      placeholder: `Enter ${this.formatFieldName(col.name).toLowerCase()}`,
      validation: this.getValidationRules(col),
    };
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
      json: "json",
    };
    return typeMap[dataType.toLowerCase()] || "text";
  }

  private mapToInputType(dataType: string): string {
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
      object: "json",
      array: "json",
      json: "json",
    };
    return typeMap[dataType.toLowerCase()] || "text";
  }

  private mapToFilterType(dataType: string): string {
    const typeMap: Record<string, string> = {
      string: "text",
      text: "text",
      int: "number",
      integer: "number",
      float: "number",
      double: "number",
      decimal: "number",
      boolean: "select",
      bool: "select",
      date: "date",
      datetime: "date",
      timestamp: "date",
    };
    return typeMap[dataType.toLowerCase()] || "text";
  }

  private formatFieldName(name: string): string {
    return name
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (str) => str.toUpperCase());
  }

  private getColumnWidth(dataType: string): number {
    const widthMap: Record<string, number> = {
      string: 150,
      text: 200,
      int: 80,
      integer: 80,
      float: 100,
      double: 100,
      decimal: 100,
      boolean: 80,
      bool: 80,
      date: 120,
      datetime: 160,
      timestamp: 160,
      object: 200,
      array: 200,
      json: 200,
    };
    return widthMap[dataType.toLowerCase()] || 150;
  }

  private getValidationRules(col: ColumnInfo): Record<string, unknown> {
    const rules: Record<string, unknown> = {};

    if (!col.nullable) {
      rules["required"] = true;
    }

    const type = col.data_type.toLowerCase();
    if (type === "string" || type === "text") {
      rules["maxLength"] = 255;
    } else if (type === "int" || type === "integer") {
      rules["min"] = -2147483648;
      rules["max"] = 2147483647;
    } else if (type === "float" || type === "double" || type === "decimal") {
      rules["min"] = -3.4e38;
      rules["max"] = 3.4e38;
    }

    return rules;
  }
}
