export interface IndexDefinition {
  name: string;
  type: "single" | "compound" | "text" | "geospatial" | "ttl" | "hashed";
  fields: IndexField[];
  options: IndexOptions;
}
export interface IndexField {
  name: string;
  direction: "asc" | "desc";
  weight?: number;
}
export interface IndexOptions {
  unique?: boolean;
  sparse?: boolean;
  ttlSeconds?: number;
  defaultLanguage?: string;
  [key: string]: unknown;
}
