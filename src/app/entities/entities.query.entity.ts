import { RawResult } from "./entities.connection.config";

export interface QueryTab {
  id: string;
  name: string;
  query: string;
  results: RawResult | null;
  error: string;
  loading: boolean;
  modified: boolean;
  executionTime: number;
}
