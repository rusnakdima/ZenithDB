export interface CollectionMeta {
  name: string;
  count: number;
}

export interface DatabaseMeta {
  name: string;
  size_bytes?: number;
  table_count?: number;
}

export interface CollectionSchema {
  name: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  is_primary_key: boolean;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  is_unique: boolean;
}

export interface CollectionStats {
  name: string;
  document_count: number;
  size_bytes: number;
  index_count: number;
}

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
  | "in"
  | "notIn"
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

export type ConnectionConfig =
  | { type: "json"; name: string; path: string }
  | { type: "mongo"; name: string; uri: string; database: string }
  | { type: "redis"; name: string; uri: string }
  | { type: "postgres"; name: string; uri: string }
  | { type: "sqlite"; name: string; path: string }
  | { type: "mysql"; name: string; uri: string };

export type ConnectionConfigEnum =
  | { type: "Json"; name: string; path: string; behavior?: string }
  | { type: "Mongo"; name: string; uri: string; database: string }
  | { type: "Redis"; name: string; uri: string }
  | { type: "Postgres"; name: string; uri: string }
  | { type: "Sqlite"; name: string; path: string }
  | { type: "MySql"; name: string; uri: string };

export interface ConnectionConfigResult {
  id: string;
  config: {
    name: string;
    config: ConnectionConfigEnum;
  };
}

export interface TestConnectionConfig {
  name: string;
  config: ConnectionConfigEnum;
}

export interface ConnectionSummary {
  id: string;
  name: string;
  provider: string;
  status?: "connected" | "disconnected";
}

export interface ConnectionHealth {
  healthy: boolean;
  provider: string;
  server_version?: string;
  latency_ms?: number;
  ok?: boolean;
  version?: string;
  message?: string;
}

export interface SystemMetrics {
  cpu_usage: number;
  ram_used: number;
  ram_total: number;
  disk_used: number;
  disk_total: number;
  network_received: number;
  network_transmitted: number;
  uptime: number;
  status: string;
}

export type RowData = Record<string, unknown>;
