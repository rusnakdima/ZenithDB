import { Injectable, inject } from "@angular/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { ToastService } from "@services/toast.service";
import { LoadingService } from "@shared/services/loading.service";
import { logger } from "../../services/logger.service";
import { RowData } from "@shared/models/connection.config";
import { escapeCsvValue, escapeSqlValue } from "@shared/utils/string.utils";

type FileFilter = {
  name: string;
  extensions: string[];
};

type ExportFormat = "csv" | "json" | "jsonl" | "sql" | "markdown";

type ExportOptions = {
  format: ExportFormat;
  filename: string;
  includeHeaders?: boolean;
  tableName?: string;
};

@Injectable({ providedIn: "root" })
export class ExportService {
  private toast = inject(ToastService) as ToastService;
  private loading = inject(LoadingService) as LoadingService;

  private validateExportData(data: RowData[]): boolean {
    if (!data || data.length === 0) {
      this.toast.warning("No data to export");
      return false;
    }
    return true;
  }

  async exportToCsv(data: RowData[], filename: string, includeHeaders = true): Promise<void> {
    if (!this.validateExportData(data)) return;

    const headers = Object.keys(data[0]);
    const rows = data.map((row) => headers.map((h) => escapeCsvValue(row[h])).join(","));
    const content = includeHeaders ? [headers.join(","), ...rows].join("\n") : rows.join("\n");

    await this.saveFile(content, filename, [{ name: "CSV Files", extensions: ["csv"] }]);
  }

  async exportToJson(data: RowData[], filename: string): Promise<void> {
    if (!this.validateExportData(data)) return;

    const content = JSON.stringify(data, null, 2);
    await this.saveFile(content, filename, [{ name: "JSON Files", extensions: ["json"] }]);
  }

  async exportToJsonLines(data: RowData[], filename: string): Promise<void> {
    if (!this.validateExportData(data)) return;

    const content = data.map((row) => JSON.stringify(row)).join("\n");
    await this.saveFile(content, filename, [
      { name: "JSONL Files", extensions: ["jsonl"] },
      { name: "Text Files", extensions: ["txt"] },
    ]);
  }

  async exportToSql(data: RowData[], tableName: string, filename: string): Promise<void> {
    if (!this.validateExportData(data)) return;

    const headers = Object.keys(data[0]);
    const statements = data.map((row) => {
      const values = headers.map((h) => escapeSqlValue(row[h]));
      return `INSERT INTO ${tableName} (${headers.join(", ")}) VALUES (${values.join(", ")});`;
    });

    const content = statements.join("\n");
    await this.saveFile(content, filename, [{ name: "SQL Files", extensions: ["sql"] }]);
  }

  async exportToMarkdown(data: RowData[], filename: string): Promise<void> {
    if (!this.validateExportData(data)) return;

    const headers = Object.keys(data[0]);
    const headerRow = `| ${headers.join(" | ")} |`;
    const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;
    const dataRows = data.map(
      (row) => `| ${headers.map((h) => String(row[h] ?? "")).join(" | ")} |`
    );

    const content = [headerRow, separatorRow, ...dataRows].join("\n");
    await this.saveFile(content, filename, [{ name: "Markdown Files", extensions: ["md"] }]);
  }

  async export(options: ExportOptions, data: RowData[]): Promise<void> {
    logger.debug("[EXPORT]", "export started", {
      format: options.format,
      filename: options.filename,
      rowCount: data.length,
    });
    const { format, filename, includeHeaders = true, tableName = "data" } = options;

    this.loading.show(`Exporting to ${format.toUpperCase()}...`);

    try {
      switch (format) {
        case "csv":
          await this.exportToCsv(data, filename, includeHeaders);
          break;
        case "json":
          await this.exportToJson(data, filename);
          break;
        case "jsonl":
          await this.exportToJsonLines(data, filename);
          break;
        case "sql":
          await this.exportToSql(data, tableName, filename);
          break;
        case "markdown":
          await this.exportToMarkdown(data, filename);
          break;
      }
      this.toast.success(`Exported ${data.length} rows to ${format.toUpperCase()}`);
      logger.debug("[EXPORT]", "export completed", { format });
    } catch (error) {
      const err = error as Error;
      logger.error("[EXPORT]", "export failed", { format, error: err.message });
      if (err.message !== "Export cancelled") {
        this.toast.error(`Export failed: ${err.message}`);
      }
    } finally {
      this.loading.hide();
    }
  }

  private async saveFile(
    content: string,
    defaultName: string,
    filters: FileFilter[]
  ): Promise<void> {
    try {
      const filePath = await save({
        defaultPath: defaultName,
        filters,
      });

      if (!filePath) {
        throw new Error("Export cancelled");
      }

      await writeTextFile(filePath, content);
    } catch (err) {
      const error = err as Error;
      if (error.message === "Export cancelled") {
        throw error;
      }
      throw new Error(`Failed to save file: ${error.message}`);
    }
  }
}
