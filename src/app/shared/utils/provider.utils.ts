import { Injectable } from "@angular/core";

import { ProviderType } from "@shared/models/provider.model";

export type { ProviderType };

const ICON_MAP: Record<ProviderType, string> = {
  json: "description",
  mongo: "eco",
  redis: "flash_on",
  postgres: "storage",
  sqlite: "insert_drive_file",
  mysql: "storage",
};

const COLOR_MAP: Record<string, string> = {
  postgresql: "text-blue-500",
  mongodb: "text-green-500",
  mysql: "text-orange-500",
  sqlite: "text-slate-400",
  redis: "text-red-500",
  json: "text-yellow-500",
};

const TYPE_MAP: Record<string, ProviderType> = {
  postgresql: "postgres",
  mongodb: "mongo",
  mysql: "mysql",
  sqlite: "sqlite",
  redis: "redis",
  json: "json",
};

const CONFIG_TYPE_MAP: Record<ProviderType, string> = {
  json: "Json",
  mongo: "Mongo",
  redis: "Redis",
  postgres: "Postgres",
  sqlite: "Sqlite",
  mysql: "MySql",
};

@Injectable({ providedIn: "root" })
export class ProviderUtils {
  getProviderIcon(provider: string): string {
    const p = provider?.toLowerCase() || "";
    if (p.includes("mongo")) return ICON_MAP.mongo;
    if (p.includes("postgres")) return ICON_MAP.postgres;
    if (p.includes("redis")) return ICON_MAP.redis;
    if (p.includes("mysql")) return ICON_MAP.mysql;
    if (p.includes("sqlite")) return ICON_MAP.sqlite;
    if (p.includes("json")) return ICON_MAP.json;
    return "dns";
  }

  getProviderColor(provider: string): string {
    const p = provider?.toLowerCase() || "";
    if (p.includes("postgresql")) return COLOR_MAP["postgresql"];
    if (p.includes("mongodb")) return COLOR_MAP["mongodb"];
    if (p.includes("mysql")) return COLOR_MAP["mysql"];
    if (p.includes("sqlite")) return COLOR_MAP["sqlite"];
    if (p.includes("redis")) return COLOR_MAP["redis"];
    if (p.includes("json")) return COLOR_MAP["json"];
    return "text-emerald-500";
  }

  toProviderType(type: string): ProviderType {
    const normalized = type.toLowerCase();
    const mapped = TYPE_MAP[normalized];
    if (mapped) return mapped;
    if (normalized.includes("mongo")) return "mongo";
    if (normalized.includes("postgres")) return "postgres";
    if (normalized.includes("redis")) return "redis";
    if (normalized.includes("mysql")) return "mysql";
    if (normalized.includes("sqlite")) return "sqlite";
    if (normalized.includes("json")) return "json";
    return "json";
  }

  toConfigType(provider: ProviderType): string {
    return CONFIG_TYPE_MAP[provider] || provider;
  }
}
