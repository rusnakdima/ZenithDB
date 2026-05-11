use crate::commands::cancellation::{register_query, unregister_query, with_cancellation};
use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::metrics::record_query;
use crate::commands::rate_limit::check_rate_limit;
use crate::commands::validation::validate_query_size;
use crate::dispatch_provider;
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryParams {
  pub filter: Option<Value>,
  pub order_by: Option<String>,
  pub direction: Option<String>,
  pub skip: Option<u64>,
  pub limit: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
  pub data: Vec<Value>,
  pub total: u64,
  pub has_more: bool,
}

fn parse_filter(filter_val: Option<Value>) -> Result<Option<Filter>, String> {
  match filter_val {
    Some(val) => Filter::from_json(&val).map_err_string().map(Some),
    None => Ok(None),
  }
}

#[tauri::command]
pub async fn query_data(
  conn_id: &str,
  collection: &str,
  query: QueryParams,
) -> Result<QueryResult, String> {
  check_rate_limit(conn_id).await?;
  let entry = get_connection_entry(conn_id).await?;
  let filter = parse_filter(query.filter)?;
  let skip = query.skip;
  let limit = query.limit;
  let sort_by = query.order_by.as_deref();
  let sort_asc = query.direction.as_deref() != Some("desc");

  let (query_id, token) = register_query().await?;

  let result = with_cancellation(&query_id, token, async {
    record_query(async {
      let (data, total) = dispatch_provider!(entry, provider => {
          let total = provider.count(collection, filter.as_ref()).await.map_err_string()?;
          let data = provider
              .find_many(collection, filter.as_ref(), skip, limit, sort_by, sort_asc)
              .await
              .map_err_string()?;
          Ok::<_, String>((data, total))
      })?;

      let has_more = if let (Some(_skip), Some(limit)) = (skip, limit) {
        data.len() as u64 >= limit
      } else {
        false
      };

      Ok(QueryResult {
        data,
        total,
        has_more,
      })
    })
    .await
  })
  .await;

  unregister_query(&query_id).await;
  result
}
