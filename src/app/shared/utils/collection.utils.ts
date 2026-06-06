import { signal } from "@angular/core";
import { RowData } from "@shared/models/connection.config";

export function trackByRow(index: number, row: RowData): string {
  return String(row["_id"] || row["id"] || index);
}

export function trackByIndex(index: number): number {
  return index;
}

export const isNullOrUndefined = (value: unknown): boolean => value === null || value === undefined;

export const createLoadingSignal = () => signal(false);
export const createErrorSignal = () => signal<string | null>(null);
