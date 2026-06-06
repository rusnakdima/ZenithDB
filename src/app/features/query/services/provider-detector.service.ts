import { Injectable, inject, signal, computed } from "@angular/core";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ProviderInfo, ProviderType, PROVIDER_METADATA, SyntaxMode } from "../models";

@Injectable({ providedIn: "root" })
export class ProviderDetectorService {
  private readonly connectionState = inject(ConnectionStateService);

  private readonly currentProviderInfoSignal = signal<ProviderInfo | null>(null);

  readonly currentProviderInfo = this.currentProviderInfoSignal.asReadonly();

  readonly currentSyntaxMode = computed<SyntaxMode>(() => {
    const info = this.currentProviderInfoSignal();
    return info?.syntaxMode ?? "sql";
  });

  readonly currentProviderType = computed<ProviderType | null>(() => {
    const info = this.currentProviderInfoSignal();
    return info?.type ?? null;
  });

  readonly supportsAggregation = computed<boolean>(() => {
    const info = this.currentProviderInfoSignal();
    return info?.supportsAggregation ?? false;
  });

  readonly supportsTransactions = computed<boolean>(() => {
    const info = this.currentProviderInfoSignal();
    return info?.supportsTransactions ?? false;
  });

  readonly supportsFullTextSearch = computed<boolean>(() => {
    const info = this.currentProviderInfoSignal();
    return info?.supportsFullTextSearch ?? false;
  });

  updateFromConnection(connection: { provider?: string; type?: string } | null): void {
    if (!connection) {
      this.currentProviderInfoSignal.set(null);
      return;
    }

    const provider = connection.provider?.toLowerCase() ?? "postgresql";
    const info = PROVIDER_METADATA[provider] ?? PROVIDER_METADATA["postgresql"];
    this.currentProviderInfoSignal.set(info);
  }

  getProviderInfo(providerKey: string): ProviderInfo {
    return PROVIDER_METADATA[providerKey.toLowerCase()] ?? PROVIDER_METADATA["postgresql"];
  }

  getAllProviders(): ProviderInfo[] {
    return Object.values(PROVIDER_METADATA);
  }

  isSqlProvider(providerKey?: string): boolean {
    if (!providerKey) {
      const info = this.currentProviderInfoSignal();
      return info?.type === "sql";
    }
    return this.getProviderInfo(providerKey).type === "sql";
  }

  isNoSqlProvider(providerKey?: string): boolean {
    if (!providerKey) {
      const info = this.currentProviderInfoSignal();
      return info?.type !== "sql";
    }
    return this.getProviderInfo(providerKey).type !== "sql";
  }

  getSyntaxForProvider(providerKey: string): SyntaxMode {
    return this.getProviderInfo(providerKey).syntaxMode;
  }
}
