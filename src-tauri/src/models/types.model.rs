use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct QueryParams {
  pub filter: Option<String>,
  pub sort: Option<String>,
  pub limit: Option<i64>,
  pub skip: Option<i64>,
  #[serde(rename = "direction")]
  pub direction: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct QueryResult<T> {
  pub data: Vec<T>,
  pub total: i64,
  pub has_more: bool,
}
