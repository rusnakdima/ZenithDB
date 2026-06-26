export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "like"
  | "isNull"
  | "isNotNull"
  | "in"
  | "notIn"
  | "between"
  | "and"
  | "or"
  | "not";

export interface FilterExpression {
  and?: FilterExpression[];
  or?: FilterExpression[];
  not?: FilterExpression;
  field?: string;
  operator?: FilterOperator;
  value?: unknown;
}

export interface QueryParams {
  filter?: FilterExpression;
  order_by?: string;
  direction?: string;
  skip?: number;
  limit?: number;
  select?: string[];
}

export interface QueryResult<T = unknown> {
  data: T[];
  total: number;
  has_more: boolean;
}

export type RawRow = unknown[];

export interface RawResult {
  columns: string[];
  rows: RawRow[];
  affected_rows: number;
}

export type RowData = Record<string, unknown>;
