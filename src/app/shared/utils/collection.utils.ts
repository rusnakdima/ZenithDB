import { RowData } from "@entities/entities.connection.config";

export function trackByRow(index: number, row: RowData): string {
  return String(row["_id"] || row["id"] || index);
}

export function trackByIndex(index: number): number {
  return index;
}

export const isNullOrUndefined = (value: unknown): boolean => value === null || value === undefined;
