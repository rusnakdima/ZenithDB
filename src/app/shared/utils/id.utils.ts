export function generateId(prefix?: string): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export const generateTransactionId = () => generateId("tx");
export const generateBatchId = () => generateId("batch");
export const generateLogId = () => generateId("log");
export const generateQueryId = () => generateId("query");
export const generateTabId = () => generateId("tab");
