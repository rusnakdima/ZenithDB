import { Injectable } from "@angular/core";

import { ProviderType } from "@shared/models/provider.model";

export type { ProviderType };

export const PROVIDER_REGISTRY: Record<
  ProviderType,
  {
    icon: string;
    color: string;
    isNetwork: boolean;
    normalize: (type: string) => ProviderType;
  }
> = {
  json: {
    icon: "description",
    color: "text-yellow-500",
    isNetwork: false,
    normalize: () => "json",
  },
  mongo: { icon: "eco", color: "text-green-500", isNetwork: true, normalize: () => "mongo" },
  redis: { icon: "flash_on", color: "text-red-500", isNetwork: true, normalize: () => "redis" },
  postgres: {
    icon: "storage",
    color: "text-blue-500",
    isNetwork: true,
    normalize: () => "postgres",
  },
  sqlite: {
    icon: "insert_drive_file",
    color: "text-slate-400",
    isNetwork: false,
    normalize: () => "sqlite",
  },
  mysql: { icon: "storage", color: "text-orange-500", isNetwork: true, normalize: () => "mysql" },
};

const PROVIDER_KEYS: Record<string, ProviderType> = {
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
    const type = this.toProviderType(provider);
    return PROVIDER_REGISTRY[type]?.icon ?? "dns";
  }

  toProviderType(type: string): ProviderType {
    const normalized = type?.toLowerCase() || "";
    const mapped = PROVIDER_KEYS[normalized];
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
    return CONFIG_TYPE_MAP[provider] ?? provider;
  }

  isNetworkProvider(provider: ProviderType): boolean {
    return PROVIDER_REGISTRY[provider]?.isNetwork ?? false;
  }

  isSingleDatabaseProvider(provider: ProviderType): boolean {
    return provider === "json" || provider === "sqlite";
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }
}
