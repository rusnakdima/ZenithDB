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
import { DataflowLoggerService } from "@shared/services/dataflow-logger.service";
import { logger } from "../../services/logger.service";

@Injectable({ providedIn: "root" })
export class ConnectionService {
  private loadingService = inject(LoadingService);
  private api = inject(ApiProvider);
  private appLogger = inject(DataflowLoggerService, { optional: true });

  async listConnections(): Promise<ConnectionSummary[]> {
    const startTime = performance.now();
    const result = await this.api.listConnections();
    this.appLogger?.logApiCall("connection", "listConnections", "connection_list", {
      count: result.length,
    });
    return result;
  }

  async getConnection(id: string) {
    const startTime = performance.now();
    const result = await withLoading(this.loadingService, "Loading connection...", () =>
      this.api.getConnection(id)
    );
    this.appLogger?.logDataReceive(
      "connection",
      "getConnection",
      "connection_get",
      { id },
      performance.now() - startTime
    );
    return result;
  }

  async saveConnection(config: TestConnectionConfig): Promise<string> {
    const startTime = performance.now();
    const result = await withLoading(this.loadingService, "Saving connection...", () =>
      this.api.saveConnection(config)
    );
    this.appLogger?.logDataReceive(
      "connection",
      "saveConnection",
      "connection_save",
      { name: config.name },
      performance.now() - startTime
    );
    return result;
  }

  async deleteConnection(id: string): Promise<void> {
    const startTime = performance.now();
    await withLoading(this.loadingService, "Deleting connection...", () =>
      this.api.deleteConnection(id)
    );
    this.appLogger?.logUserAction("connection", "deleteConnection", { id });
  }

  async testConnection(config: TestConnectionConfig): Promise<ConnectionHealth> {
    const startTime = performance.now();
    const result = await withLoading(this.loadingService, "Testing connection...", () =>
      this.api.testConnection(config)
    );
    this.appLogger?.logDataReceive(
      "connection",
      "testConnection",
      "connection_test",
      { healthy: result.healthy },
      performance.now() - startTime
    );
    return result;
  }

  async testConnectionById(connId: string): Promise<ConnectionHealth | null> {
    const startTime = performance.now();
    try {
      const fullConn = await this.getConnection(connId);
      const config = {
        name: fullConn.config.name,
        config: fullConn.config.config,
      };
      const result = await this.api.testConnection(config);
      this.appLogger?.logDataReceive(
        "connection",
        "testConnectionById",
        "connection_test",
        { connId, healthy: result.healthy },
        performance.now() - startTime
      );
      return result;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.appLogger?.warn("[CONNECTION]", "Failed to test connection", { error });
      this.appLogger?.logUserAction("connection", "testConnectionById", {
        connId,
        error: String(e),
      });
      return null;
    }
  }

  async testConnectionStatus(connId: string): Promise<ConnectionSummary | null> {
    const startTime = performance.now();
    try {
      const result = await this.api.testConnectionStatus(connId);
      this.appLogger?.logDataReceive(
        "connection",
        "testConnectionStatus",
        "connection_status",
        { connId },
        performance.now() - startTime
      );
      return result;
    } catch (e) {
      this.appLogger?.logUserAction("connection", "testConnectionStatus", {
        connId,
        error: String(e),
      });
      return null;
    }
  }

  async updateConnection(id: string, config: TestConnectionConfig): Promise<void> {
    const startTime = performance.now();
    await this.api.updateConnection(id, config);
    this.appLogger?.logUserAction("connection", "updateConnection", { id });
  }
}
