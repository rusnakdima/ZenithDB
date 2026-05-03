export interface QueryParams {
  filter?: any;
  order_by?: string;
  direction?: string;
  skip?: number;
  limit?: number;
  select?: string[];
}

export interface QueryResult {
  data: any[];
  total: number;
  has_more: boolean;
}
