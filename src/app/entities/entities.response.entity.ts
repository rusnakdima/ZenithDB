export interface ApiResponse<T> {
  status: "success" | "error" | "info" | "warning";
  message: string;
  data: T;
}

export interface CollectionMeta {
  name: string;
  count: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}
