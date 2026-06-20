import { Injectable, inject } from "@angular/core";
import { LoadingService } from "@shared/services/loading.service";
import { withLoading } from "@shared/utils/api-wrapper.util";
import { ApiProvider } from "@providers/providers.api.provider";
import {
  ConnectionSummary,
  ConnectionConfig,
  ConnectionConfigResult,
  TestConnectionConfig,
  ConnectionHealth,
} from "@entities/entities.connection.config";

@Injectable({ providedIn: "root" })
export class ConnectionService {
  private loadingService = inject(LoadingService);
  private api = inject(ApiProvider);

  async listConnections(): Promise<ConnectionSummary[]> {
    const result = await this.api.listConnections();
    return result;
  }

  async getConnection(id: string): Promise<ConnectionConfigResult> {
    const result = await withLoading(this.loadingService, "Loading connection...", () =>
      this.api.getConnection(id)
    );
    return result;
  }

  async saveConnection(config: TestConnectionConfig): Promise<string> {
    const result = await withLoading(this.loadingService, "Saving connection...", () =>
      this.api.saveConnection(config)
    );
    return result;
  }

  async deleteConnection(id: string): Promise<void> {
    await withLoading(this.loadingService, "Deleting connection...", () =>
      this.api.deleteConnection(id)
    );
  }

  async testConnection(config: TestConnectionConfig): Promise<ConnectionHealth> {
    const result = await withLoading(this.loadingService, "Testing connection...", () =>
      this.api.testConnection(config)
    );
    return result;
  }

  async testConnectionById(connId: string): Promise<ConnectionHealth | null> {
    try {
      const fullConn = await this.getConnection(connId);
      const config = {
        name: fullConn.config.name,
        config: fullConn.config.config,
      };
      const result = await this.api.testConnection(config);
      return result;
    } catch (e) {
      return null;
    }
  }

  async testConnectionStatus(connId: string): Promise<ConnectionSummary | null> {
    try {
      const result = await this.api.testConnectionStatus(connId);
      return result;
    } catch (e) {
      return null;
    }
  }

  async updateConnection(id: string, config: TestConnectionConfig): Promise<void> {
    await this.api.updateConnection(id, config);
  }
}
