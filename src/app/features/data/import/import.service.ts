import { Injectable, inject, signal } from "@angular/core";
import { ToastService } from "@services/services.toast.service";
import { ApiProvider } from "@providers/providers.api.provider";
import { ConnectionStateService } from "@services/services.connection-state.service";
export interface ParsedData {
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  format: "csv" | "json" | "jsonl";
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
}

export interface ImportOptions {
  collection: string;
  mappings: FieldMapping[];
  updateExisting: boolean;
  batchSize: number;
}

export interface ImportResult {
  imported: number;
  updated: number;
  errors: string[];
  duration: number;
}

export interface ImportProgress {
  current: number;
  total: number;
  percentage: number;
}

@Injectable({ providedIn: "root" })
export class ImportService {
  private toast = inject(ToastService);
  private api = inject(ApiProvider);
  private connectionState = inject(ConnectionStateService);

  private progressSignal = signal<ImportProgress | null>(null);
  readonly progress = this.progressSignal.asReadonly();

  async parseFile(file: File): Promise<ParsedData> {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const format = this.detectFormat(extension);

    const text = await file.text();

    switch (format) {
      case "csv":
        return this.parseCSV(text);
      case "json":
        return this.parseJSON(text);
      case "jsonl":
        return this.parseJSONL(text);
      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  }

  private detectFormat(extension?: string): "csv" | "json" | "jsonl" {
    switch (extension) {
      case "csv":
        return "csv";
      case "json":
        return "json";
      case "jsonl":
      case "ndjson":
        return "jsonl";
      default:
        return "csv";
    }
  }

  private parseCSV(text: string): ParsedData {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0) {
      return { headers: [], rows: [], totalRows: 0, format: "csv" };
    }

    const delimiter = this.detectCSVDelimiter(lines[0]);
    const headers = this.parseCSVLine(lines[0], delimiter);
    const rows: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i], delimiter);
      const row: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] ?? "";
      });
      rows.push(row);
    }

    return {
      headers,
      rows,
      totalRows: rows.length,
      format: "csv",
    };
  }

  private detectCSVDelimiter(line: string): string {
    const delimiters = [",", ";", "\t", "|"];
    let maxCount = 0;
    let detected = ",";

    for (const delimiter of delimiters) {
      const count = (line.match(new RegExp(`\\${delimiter}`, "g")) || []).length;
      if (count > maxCount) {
        maxCount = count;
        detected = delimiter;
      }
    }

    return detected;
  }

  private parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  private parseJSON(text: string): ParsedData {
    const data = JSON.parse(text);
    const rows = Array.isArray(data) ? data : [data];

    if (rows.length === 0) {
      return { headers: [], rows: [], totalRows: 0, format: "json" };
    }

    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];

    return {
      headers,
      rows,
      totalRows: rows.length,
      format: "json",
    };
  }

  private parseJSONL(text: string): ParsedData {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    const rows: Record<string, unknown>[] = [];

    for (const line of lines) {
      try {
        rows.push(JSON.parse(line));
      } catch {
        continue;
      }
    }

    if (rows.length === 0) {
      return { headers: [], rows: [], totalRows: 0, format: "jsonl" };
    }

    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];

    return {
      headers,
      rows,
      totalRows: rows.length,
      format: "jsonl",
    };
  }

  async importData(
    collection: string,
    data: Record<string, unknown>[],
    options: ImportOptions,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const connId = this.connectionState.activeConnectionId();
    if (!connId) {
      throw new Error("No active connection");
    }

    const startTime = performance.now();
    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    const total = data.length;
    this.progressSignal.set({ current: 0, total, percentage: 0 });

    for (let i = 0; i < data.length; i += options.batchSize) {
      const batch = data.slice(i, i + options.batchSize);
      const mappedBatch = batch.map((row) => this.applyMappings(row, options.mappings));

      for (const row of mappedBatch) {
        try {
          const result = await this.api.saveRow(
            connId,
            collection,
            row as import("@entities/entities.connection.config").RowData
          );
          if (result) {
            imported++;
          } else {
            updated++;
          }
        } catch (e) {
          errors.push(`Row ${i}: ${(e as Error).message}`);
        }
      }

      const current = Math.min(i + options.batchSize, total);
      const percentage = Math.round((current / total) * 100);
      const progress: ImportProgress = { current, total, percentage };
      this.progressSignal.set(progress);
      onProgress?.(progress);
    }

    const duration = performance.now() - startTime;
    this.progressSignal.set(null);

    if (errors.length > 0) {
      this.toast.warning(`Import completed with ${errors.length} errors`);
    } else {
      this.toast.success(
        `Imported ${imported} rows${updated > 0 ? `, updated ${updated} rows` : ""}`
      );
    }

    return { imported, updated, errors, duration };
  }

  private applyMappings(
    row: Record<string, unknown>,
    mappings: FieldMapping[]
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const mapping of mappings) {
      result[mapping.targetField] = row[mapping.sourceField] ?? null;
    }

    return result;
  }

  generateAutoMappings(headers: string[], targetFields: string[]): FieldMapping[] {
    const mappings: FieldMapping[] = [];

    for (const header of headers) {
      const normalizedHeader = header.toLowerCase().replace(/[_\s-]/g, "");
      const matchingField = targetFields.find(
        (field) =>
          field.toLowerCase().replace(/[_\s-]/g, "") === normalizedHeader ||
          field.toLowerCase() === header.toLowerCase()
      );

      if (matchingField) {
        mappings.push({ sourceField: header, targetField: matchingField });
      }
    }

    return mappings;
  }

  previewMappedData(
    rows: Record<string, unknown>[],
    mappings: FieldMapping[]
  ): Record<string, unknown>[] {
    return rows.slice(0, 10).map((row) => this.applyMappings(row, mappings));
  }
}
