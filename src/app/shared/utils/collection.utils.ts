import { RowData } from "@shared/models/connection.config";

export function trackByRow(index: number, row: RowData): string {
  return String(row["_id"] || row["id"] || index);
}

export function trackByIndex(index: number): number {
  return index;
}
