export type ProviderType = "sql" | "mongodb" | "redis" | "json";
export type SqlDialect = "postgresql" | "mysql" | "sqlite";
export type NoSqlDialect = "mongodb" | "redis" | "json";
export type SyntaxMode = "sql" | "mongodb" | "json" | "keyvalue";

export interface ProviderInfo {
  type: ProviderType;
  dialect: SqlDialect | NoSqlDialect;
  displayName: string;
  supportsAggregation: boolean;
  supportsTransactions: boolean;
  supportsIndexes: boolean;
  supportsFullTextSearch: boolean;
  syntaxMode: SyntaxMode;
  icon: string;
}

export const PROVIDER_METADATA: Record<string, ProviderInfo> = {
  postgresql: {
    type: "sql",
    dialect: "postgresql",
    displayName: "PostgreSQL",
    supportsAggregation: true,
    supportsTransactions: true,
    supportsIndexes: true,
    supportsFullTextSearch: true,
    syntaxMode: "sql",
    icon: "postgres",
  },
  mysql: {
    type: "sql",
    dialect: "mysql",
    displayName: "MySQL",
    supportsAggregation: true,
    supportsTransactions: true,
    supportsIndexes: true,
    supportsFullTextSearch: true,
    syntaxMode: "sql",
    icon: "mysql",
  },
  sqlite: {
    type: "sql",
    dialect: "sqlite",
    displayName: "SQLite",
    supportsAggregation: true,
    supportsTransactions: true,
    supportsIndexes: true,
    supportsFullTextSearch: false,
    syntaxMode: "sql",
    icon: "sqlite",
  },
  mongodb: {
    type: "mongodb",
    dialect: "mongodb",
    displayName: "MongoDB",
    supportsAggregation: true,
    supportsTransactions: true,
    supportsIndexes: true,
    supportsFullTextSearch: true,
    syntaxMode: "mongodb",
    icon: "mongodb",
  },
  redis: {
    type: "redis",
    dialect: "redis",
    displayName: "Redis",
    supportsAggregation: false,
    supportsTransactions: true,
    supportsIndexes: true,
    supportsFullTextSearch: false,
    syntaxMode: "keyvalue",
    icon: "redis",
  },
  json: {
    type: "json",
    dialect: "json",
    displayName: "JSON",
    supportsAggregation: true,
    supportsTransactions: false,
    supportsIndexes: true,
    supportsFullTextSearch: true,
    syntaxMode: "json",
    icon: "json",
  },
};
