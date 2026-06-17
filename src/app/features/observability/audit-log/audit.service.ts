import { Injectable, inject, signal } from "@angular/core";
import { ConnectionStateService } from "@shared/services/connection-state.service";
import { ApiProvider } from "@providers/api.provider";
import { LoadingService } from "@shared/services/loading.service";
import { withConnectionAndLoading } from "@shared/utils/api-wrapper.util";
import { logger } from "../../../services/logger.service";
import { AuditFilter as TauriAuditFilter } from "./audit.service";

export type AuditOperation = "Insert" | "Update" | "Delete" | "SoftDelete" | "Restore";

export interface AuditEntry {
  id: string;
  timestamp: string;
  operation: AuditOperation;
  collection: string;
  documentId: string;
  user?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface AuditFilter {
  operations?: AuditOperation[];
  collection?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

@Injectable({ providedIn: "root" })
export class AuditService {
  private connectionState = inject(ConnectionStateService);
  private api = inject(ApiProvider);
  private loadingService = inject(LoadingService);

  private auditLogSignal = signal<AuditEntry[]>([]);
  readonly auditLog = this.auditLogSignal.asReadonly();

  async fetchAuditLog(filter?: AuditFilter): Promise<AuditEntry[]> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) {
      throw new Error("No active connection");
    }

    logger.debug("[AUDIT]", "Fetching audit log", { filter });
    return withConnectionAndLoading(
      connId,
      this.loadingService,
      "Loading audit log...",
      async (connId) => {
        try {
          const result = await this.api.getAuditLog(connId, filter);
          const typedResult = result.map((entry) => ({
            ...entry,
            operation: entry.operation as AuditOperation,
          }));
          this.auditLogSignal.set(typedResult);
          return typedResult;
        } catch {
          const mockLog: AuditEntry[] = [];
          this.auditLogSignal.set(mockLog);
          return mockLog;
        }
      }
    );
  }

  async exportAuditLog(
    format: "csv" | "json",
    filter?: AuditFilter
  ): Promise<{ filename: string; content: string }> {
    logger.info("[AUDIT]", "Exporting audit log", { format });
    const entries = filter ? await this.fetchAuditLog(filter) : this.auditLog();

    if (format === "json") {
      return {
        filename: `audit_log_${Date.now()}.json`,
        content: JSON.stringify(entries, null, 2),
      };
    }

    const headers = ["Timestamp", "Operation", "Collection", "Document ID", "User"];
    const rows = entries.map((e) => [
      e.timestamp,
      e.operation,
      e.collection,
      e.documentId,
      e.user || "",
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return {
      filename: `audit_log_${Date.now()}.csv`,
      content: csvContent,
    };
  }

  filterEntries(entries: AuditEntry[], filter: AuditFilter): AuditEntry[] {
    return entries.filter((entry) => {
      if (filter.operations && filter.operations.length > 0) {
        if (!filter.operations.includes(entry.operation)) {
          return false;
        }
      }

      if (filter.collection) {
        if (!entry.collection.toLowerCase().includes(filter.collection.toLowerCase())) {
          return false;
        }
      }

      if (filter.startDate) {
        if (new Date(entry.timestamp) < new Date(filter.startDate)) {
          return false;
        }
      }

      if (filter.endDate) {
        if (new Date(entry.timestamp) > new Date(filter.endDate)) {
          return false;
        }
      }

      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const matchesSearch =
          entry.documentId.toLowerCase().includes(query) ||
          entry.collection.toLowerCase().includes(query) ||
          (entry.user && entry.user.toLowerCase().includes(query));
        if (!matchesSearch) {
          return false;
        }
      }

      return true;
    });
  }

  computeDiff(
    before: Record<string, unknown> | undefined,
    after: Record<string, unknown> | undefined
  ): { field: string; before: unknown; after: unknown }[] {
    const diffs: { field: string; before: unknown; after: unknown }[] = [];
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

    for (const key of allKeys) {
      const beforeVal = before?.[key];
      const afterVal = after?.[key];
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        diffs.push({ field: key, before: beforeVal, after: afterVal });
      }
    }

    return diffs;
  }
}
