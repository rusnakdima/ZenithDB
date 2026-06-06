import { FilterOperator } from "@shared/models/connection.config";

export type FieldType = "string" | "number" | "boolean" | "date" | "array" | "object";

export interface FieldInfo {
  name: string;
  type: FieldType;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: unknown;
  description?: string;
}

export interface ConditionGroup {
  id: string;
  operator: "and" | "or";
  conditions: Condition[];
  groups?: ConditionGroup[];
}

export interface Condition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: unknown;
  valueType: FieldType;
}

export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

export interface ProjectionConfig {
  fields: string[];
  exclude: boolean;
}

export interface QueryBuilderState {
  filter: ConditionGroup | null;
  sort: SortConfig[];
  projection: ProjectionConfig | null;
  skip: number | null;
  limit: number | null;
}

export const FIELD_OPERATORS: Record<FieldType, FilterOperator[]> = {
  string: [
    "eq",
    "neq",
    "contains",
    "startsWith",
    "endsWith",
    "like",
    "isNull",
    "isNotNull",
    "in",
    "notIn",
  ],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "isNull", "isNotNull", "in", "notIn"],
  boolean: ["eq", "neq", "isNull", "isNotNull"],
  date: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "isNull", "isNotNull"],
  array: ["isNull", "isNotNull", "eq", "neq"],
  object: ["isNull", "isNotNull", "eq", "neq"],
};

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "equals",
  neq: "not equals",
  gt: "greater than",
  gte: "greater than or equal",
  lt: "less than",
  lte: "less than or equal",
  contains: "contains",
  startsWith: "starts with",
  endsWith: "ends with",
  like: "like",
  isNull: "is null",
  isNotNull: "is not null",
  in: "in",
  notIn: "not in",
  between: "between",
  and: "and",
  or: "or",
  not: "not",
};

export function createEmptyCondition(fieldType: FieldType = "string"): Condition {
  return {
    id: crypto.randomUUID(),
    field: "",
    operator: FIELD_OPERATORS[fieldType][0],
    value: "",
    valueType: fieldType,
  };
}

export function createEmptyGroup(operator: "and" | "or" = "and"): ConditionGroup {
  return {
    id: crypto.randomUUID(),
    operator,
    conditions: [createEmptyCondition()],
    groups: [],
  };
}
