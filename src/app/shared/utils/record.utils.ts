import { RowData } from "@entities/entities.connection.config";
export function getRecordId(record: RowData): string | null {
  return (record["_id"] as string) || (record["id"] as string) || null;
}
export function hasRecordId(record: RowData): boolean {
  return !!(record["_id"] || record["id"]);
}
export function requireRecordId(record: RowData): string {
  const id = getRecordId(record);
  if (!id) throw new Error("Record missing ID");
  return id;
}
