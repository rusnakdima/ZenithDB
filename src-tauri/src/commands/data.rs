use crate::commands::error_utils::ToStringError;
use crate::commands::get_auth_context;
use crate::commands::get_connection_entry;
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::dispatch_provider;
use crate::logger::DataflowTimer;
use crate::types::{QueryParams, QueryResult};
use nosql_orm::prelude::*;
use serde_json::Value;

fn parse_filter(filter_val: Option<String>) -> Result<Option<Filter>, String> {
  match filter_val {
    Some(val) => {
      let json: Value = serde_json::from_str(&val).map_err_string()?;
      Filter::from_json(&json).map_err_string().map(Some)
    }
    None => Ok(None),
  }
}

#[tauri::command]
pub async fn query_data(
  connId: &str,
  collection: &str,
  query: QueryParams,
) -> Result<QueryResult<Value>, String> {
  let timer = DataflowTimer::new("query_data");
  let auth = get_auth_context();
  if !auth.can_access_connection(connId) {
    timer.finish_error("Access denied to connection");
    return Err("Access denied to connection".to_string());
  }
  if let Err(e) = validate_conn_id(connId) {
    timer.finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(collection) {
    timer.finish_error(&e);
    return Err(e);
  }
  let params = serde_json::json!({ "connId": connId, "collection": collection, "query": &query });
  tracing::debug!(command = "query_data", params = %crate::logger::redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  let entry = get_connection_entry(connId).await?;
  let filter = parse_filter(query.filter)?;
  let skip = query.skip;
  let limit = query.limit;
  let sort_by = query.sort.as_deref();
  let sort_asc = true;

  let (data, total) = dispatch_provider!(entry, provider => {
      let total = provider.count(collection, filter.as_ref()).await.map_err_string()?;
      let data = provider
          .find_many(collection, filter.as_ref(), skip.map(|s| s as u64), limit.map(|l| l as u64), sort_by, sort_asc)
          .await
          .map_err_string()?;
      Ok::<_, String>((data, total))
  })?;

  let has_more = if let (Some(_skip), Some(limit)) = (skip, limit) {
    data.len() as i64 >= limit
  } else {
    false
  };

  let result = QueryResult {
    data: data.clone(),
    total: total as i64,
    has_more,
  };
  tracing::debug!(command = "query_data", result_count = %data.len(), total = %total, has_more = %has_more, "[COMMAND_RESULT]");
  Ok(result)
}

#[tauri::command]
pub async fn save_row(connId: &str, collection: &str, data: Value) -> Result<Value, String> {
  let timer = DataflowTimer::new("save_row");
  if let Err(e) = validate_conn_id(connId) {
    timer.finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(collection) {
    timer.finish_error(&e);
    return Err(e);
  }
  let params = serde_json::json!({ "connId": connId, "collection": collection, "data": &data });
  tracing::debug!(command = "save_row", params = %crate::logger::redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  let entry = get_connection_entry(connId).await?;
  let result = dispatch_provider!(entry, provider => {
      if let Some(id) = data.get("id").and_then(|v| v.as_str()) {
          if provider.exists(collection, id).await.map_err_string()? {
              return provider.update(collection, id, data.clone()).await.map_err_string();
          }
      }
      provider.insert(collection, data).await.map_err_string()
  })?;
  tracing::debug!(command = "save_row", "[COMMAND_RESULT]");
  Ok(result)
}

#[tauri::command]
pub async fn delete_row(connId: &str, collection: &str, id: &str) -> Result<(), String> {
  let timer = DataflowTimer::new("delete_row");
  if let Err(e) = validate_conn_id(connId) {
    timer.finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(collection) {
    timer.finish_error(&e);
    return Err(e);
  }
  let params = serde_json::json!({ "connId": connId, "collection": collection, "id": id });
  tracing::debug!(command = "delete_row", params = %crate::logger::redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  let entry = get_connection_entry(connId).await?;
  let _: () = dispatch_provider!(entry, provider => {
      provider.delete(collection, id).await.map_err_string()?;
      Ok::<(), String>(())
  })?;
  tracing::debug!(command = "delete_row", "[COMMAND_RESULT]");
  Ok(())
}
