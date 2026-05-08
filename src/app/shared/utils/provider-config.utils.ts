import { ProviderType } from "@shared/models/provider.model";

export interface ProviderFormData {
  path: string;
  uri: string;
  database: string;
  behavior: string;
}

export function parseProviderConfig(config: any): ProviderFormData {
  const result: ProviderFormData = {
    path: "",
    uri: "",
    database: "",
    behavior: "folders_as_databases",
  };

  if (!config) return result;

  switch (config.type) {
    case "Json":
      result.path = config.path || "";
      if (config.behavior) {
        result.behavior = config.behavior;
      }
      break;
    case "Sqlite":
      result.path = config.path || "";
      break;
    case "Mongo":
      result.uri = config.uri || "";
      result.database = config.database || "";
      break;
    case "Redis":
    case "Postgres":
    case "MySql":
      result.uri = config.uri || "";
      break;
  }

  return result;
}
