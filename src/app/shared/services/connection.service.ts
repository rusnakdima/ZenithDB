import { Injectable, inject } from "@angular/core";
import { LoadingService } from "@shared/services/loading.service";
import { withLoading } from "@shared/utils/api-wrapper.util";
import { ApiProvider } from "@providers/api.provider";
import {
  ConnectionSummary,
  ConnectionConfig,
  TestConnectionConfig,
  ConnectionHealth,
} from "@shared/models/connection.config";

@Injectable({ providedIn: "root" })
export class ConnectionService {
  private loadingService = inject(LoadingService);
  private api = inject(ApiProvider);

  async listConnections(): Promise<ConnectionSummary[]> {
    return withLoading(this.loadingService, "Loading connections...", () =>
      this.api.listConnections()
    );
  }

  async getConnection(id: string) {
    return withLoading(this.loadingService, "Loading connection...", () =>
      this.api.getConnection(id)
    );
  }

  async saveConnection(config: TestConnectionConfig): Promise<string> {
    return withLoading(this.loadingService, "Saving connection...", () =>
      this.api.saveConnection(config)
    );
  }

  async deleteConnection(id: string): Promise<void> {
    return withLoading(this.loadingService, "Deleting connection...", () =>
      this.api.deleteConnection(id)
    );
  }

  async testConnection(config: TestConnectionConfig): Promise<ConnectionHealth> {
    return withLoading(this.loadingService, "Testing connection...", () =>
      this.api.testConnection(config)
    );
  }

  async testConnectionById(connId: string): Promise<ConnectionHealth | null> {
    try {
      const fullConn = await this.getConnection(connId);
      const config = {
        name: fullConn.config.name,
        config: fullConn.config.config,
      };
      return await this.api.testConnection(config);
    } catch (e) {
      console.warn("Failed to test connection:", e);
      return null;
    }
  }

  async testConnectionStatus(connId: string): Promise<ConnectionSummary | null> {
    try {
      return await this.api.testConnectionStatus(connId);
    } catch (e) {
      return null;
    }
  }

  async updateConnection(id: string, config: ConnectionConfig): Promise<void> {
    return await this.api.updateConnection(id, config);
  }
}
