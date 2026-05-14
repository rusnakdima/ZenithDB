import { ProviderType } from "@shared/models/provider.model";

export interface ProviderFormData {
  path: string;
  uri: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}

export function parseProviderConfig(config: any): ProviderFormData {
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

  switch (config.type) {
    case "Json":
      result.path = config.path || "";
      break;
    case "Sqlite":
      result.path = config.path || "";
      break;
    case "Mongo":
    case "Redis":
    case "Postgres":
    case "MySql":
      result.uri = config.uri || "";
      if (config.uri) {
        const parsed = parseUri(config.uri, config.type);
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
