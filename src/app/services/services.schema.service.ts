import { Injectable, inject } from "@angular/core";
import { ConnectionStateService } from "@services/services.connection-state.service";
import { LoadingService } from "@shared/services/loading.service";
import { withConnectionAndLoading } from "@shared/utils/api-wrapper.util";
import { ApiProvider } from "@providers/providers.api.provider";
import {
  CollectionMeta,
  CollectionSchema,
  CollectionStats,
} from "@entities/entities.connection.config";

@Injectable({ providedIn: "root" })
export class SchemaService {
  private connectionState = inject(ConnectionStateService);
  private loadingService = inject(LoadingService);
  private api = inject(ApiProvider);

  async listCollections(connId?: string, dbName?: string): Promise<CollectionMeta[]> {
    const id = connId || this.connectionState.activeConnectionId();
    if (!id) {
      return [];
    }
    return withConnectionAndLoading(id, this.loadingService, "Loading collections...", (connId) =>
      this.api.listCollections(connId, dbName)
    );
  }

  async listCollectionsPaginated(
    connId: string,
    dbName?: string,
    offset = 0,
    limit = 10
  ): Promise<{ collections: CollectionMeta[]; hasMore: boolean; totalCount: number }> {
    return this.api.listCollectionsPaginated(connId, dbName, offset, limit);
  }

  async createDatabase(name: string): Promise<void> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Creating database ${name}...`,
      (connId) => this.api.createDatabase(connId, name)
    );
  }

  async describeCollection(collection: string): Promise<CollectionSchema> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Describing ${collection}...`,
      (connId) => this.api.describeCollection(connId, collection)
    );
  }

  async getCollectionStats(collection: string): Promise<CollectionStats> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Loading stats for ${collection}...`,
      (connId) => this.api.getCollectionStats(connId, collection)
    );
  }

  async getServerVersion(): Promise<string> {
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      "Fetching server version...",
      (connId) => this.api.getServerVersion(connId)
    );
  }
}
