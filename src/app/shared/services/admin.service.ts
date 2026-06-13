import { Injectable, inject } from "@angular/core";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { DataProviderService } from "@shared/services/data-provider.service";
import { LoadingService } from "@shared/services/loading.service";
import { LoggingService } from "@shared/services/logging.service";
import { withConnectionAndLoading } from "@shared/utils/api-wrapper.util";
import { ApiProvider } from "@providers/api.provider";
import { RawResult } from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class AdminService {
  private connectionState = inject(ConnectionStateService);
  private dataProvider = inject(DataProviderService);
  private loadingService = inject(LoadingService);
  private api = inject(ApiProvider);
  private logger = inject(LoggingService);

  async createCollection(name: string): Promise<void> {
    this.logger.debug("[ADMIN]", "createCollection started", { name });
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Creating collection ${name}...`,
      (connId) =>
        this.api.createCollection(connId, name).then(() => {
          this.dataProvider.invalidateColumnsCache();
        })
    );
  }

  async dropCollection(name: string): Promise<void> {
    this.logger.debug("[ADMIN]", "dropCollection started", { name });
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Dropping collection ${name}...`,
      (connId) => this.api.dropCollection(connId, name)
    );
  }

  async renameCollection(connId: string, oldName: string, newName: string): Promise<void> {
    this.logger.debug("[ADMIN]", "renameCollection started", { connId, oldName, newName });
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Renaming collection ${oldName} to ${newName}...`,
      (connId) => this.api.renameCollection(connId, oldName, newName)
    );
  }

  async renameDatabase(connId: string, oldName: string, newName: string): Promise<void> {
    this.logger.debug("[ADMIN]", "renameDatabase started", { connId, oldName, newName });
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Renaming database ${oldName} to ${newName}...`,
      (connId) => this.api.renameDatabase(connId, oldName, newName)
    );
  }

  async deleteDatabase(connId: string, name: string): Promise<void> {
    this.logger.debug("[ADMIN]", "deleteDatabase started", { connId, name });
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      `Deleting database ${name}...`,
      (connId) => this.api.deleteDatabase(connId, name)
    );
  }

  async executeRaw(sql: string): Promise<RawResult> {
    this.logger.debug("[ADMIN]", "executeRaw started", { sqlLength: sql.length });
    const connId = this.connectionState.activeConnectionId();
    return withConnectionAndLoading(connId, this.loadingService, "Executing SQL...", (connId) =>
      this.api.executeRaw(connId, sql)
    );
  }
}
