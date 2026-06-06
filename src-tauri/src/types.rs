use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
pub struct QueryParams {
  pub provider: String,
  pub connection: String,
  pub database: Option<String>,
  pub collection: Option<String>,
  pub filter: Option<String>,
  pub sort: Option<String>,
  pub limit: Option<i64>,
  pub skip: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct QueryResult<T> {
  pub data: Vec<T>,
  pub total: i64,
  pub has_more: bool,
}
