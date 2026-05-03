export interface CollectionMeta {
  name: string;
  count: number;
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

export interface QueryParams {
  filter?: any;
  order_by?: string;
  direction?: string;
  skip?: number;
  limit?: number;
  select?: string[];
}

export interface QueryResult {
  data: any[];
  total: number;
  has_more: boolean;
}

export interface RawResult {
  columns: string[];
  rows: any[][];
  affected_rows: number;
}

export type ConnectionConfig =
  | { type: "json"; name: string; path: string }
  | { type: "mongo"; name: string; uri: string; database: string }
  | { type: "redis"; name: string; uri: string }
  | { type: "postgres"; name: string; uri: string }
  | { type: "sqlite"; name: string; path: string }
  | { type: "mysql"; name: string; uri: string };

export interface ConnectionSummary {
  id: string;
  name: string;
  provider: string;
  status?: "connected" | "disconnected";
}

export interface ConnectionHealth {
  healthy: boolean;
  server_version?: string;
  latency_ms?: number;
  ok?: boolean;
  provider?: string;
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
