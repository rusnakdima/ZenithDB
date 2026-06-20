import { ProviderType } from "@entities/entities.provider.entity";
export interface ProviderFormData {
  path: string;
  uri: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}
export function parseProviderConfig(config: Record<string, unknown>): ProviderFormData {
  const result: ProviderFormData = {
    path: "",
    uri: "",
    host: "",
    port: "",
    username: "",
    password: "",
    database: "",
  };
  if (!config) return result;
  const configType = config["type"] as string;
  const configUri = config["uri"] as string | undefined;
  const configPath = config["path"] as string | undefined;
  switch (configType) {
    case "Json":
      result.path = String(configPath || "");
      break;
    case "Sqlite":
      result.path = String(configPath || "");
      break;
    case "Mongo":
    case "Redis":
    case "Postgres":
    case "MySql":
      result.uri = String(configUri || "");
      if (configUri) {
        const parsed = parseUri(String(configUri), String(configType));
        result.host = parsed.host;
        result.port = parsed.port;
        result.username = parsed.username;
        result.password = parsed.password;
        result.database = parsed.database;
      }
      break;
  }
  return result;
}
interface ParsedUri {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}
export function parseUri(uri: string, type: string): ParsedUri {
  const result: ParsedUri = {
    host: "",
    port: "",
    username: "",
    password: "",
    database: "",
  };
  try {
    let url: URL;
    if (
      uri.startsWith("mongodb://") ||
      uri.startsWith("postgres://") ||
      uri.startsWith("mysql://") ||
      uri.startsWith("redis://")
    ) {
      url = new URL(uri);
    } else {
      return result;
    }
    result.host = url.hostname || "";
    if (type === "Mongo" || type === "Redis" || type === "Postgres" || type === "MySql") {
      result.port = url.port || getDefaultPort(type);
    }
    if (url.username && url.password) {
      result.username = decodeURIComponent(url.username);
      result.password = decodeURIComponent(url.password);
    }
    const path = url.pathname?.slice(1);
    if (path) {
      result.database = decodeURIComponent(path);
    }
  } catch (e) {
    // Invalid URI, return empty result
  }
  return result;
}
function getDefaultPort(type: string): string {
  switch (type) {
    case "Mongo":
      return "27017";
    case "Postgres":
      return "5432";
    case "MySql":
      return "3306";
    case "Redis":
      return "6379";
    default:
      return "";
  }
}
