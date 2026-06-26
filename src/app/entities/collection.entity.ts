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
