use crate::commands::connection_command::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::types::RawResult;
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::dispatch_provider;
use crate::models::response::{Response, ResponseModel};
use crate::models::types::{QueryParams, QueryResult};
use crate::utils::metrics::{redact_sensitive_data, DataflowTimer};
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
fn validate_sql(sql: &str) -> Result<(), String> {
  let trimmed = sql.trim();
  if trimmed.is_empty() {
    return Err("Empty SQL statement".to_string());
  }
  let upper = trimmed.to_uppercase();
  let allowed = [
    "SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER", "SHOW", "USE", "DESCRIBE",
    "EXPLAIN",
  ];
  if !allowed.iter().any(|cmd| upper.starts_with(cmd)) {
    return Err("Only SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, SHOW, USE, DESCRIBE, EXPLAIN are allowed".to_string());
  }
  if trimmed.contains(';') {
    return Err("Multiple statements not allowed".to_string());
  }
  if trimmed.contains("--") || trimmed.contains("/*") || trimmed.contains("*/") {
    return Err("SQL comments not allowed".to_string());
  }
  Ok(())
}
#[tauri::command(rename_all = "camelCase")]
pub async fn query_execute(
  connectionId: String,
  collection: String,
  params: QueryParams,
) -> Result<Response<QueryResult<Value>>, String> {
  let timer = DataflowTimer::new("query_execute");
  let params_log = serde_json::json!({ "connectionId": &connectionId, "collection": &collection, "params": &params });
  if let Err(e) = validate_conn_id(&connectionId) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&connectionId).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  let filter = match parse_filter(params.filter.clone()) {
    Ok(f) => f,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  let skip = params.skip;
  let limit = params.limit;
  let sort_by = params.sort.as_deref();
  let sort_asc = params
    .direction
    .as_deref()
    .map(|d| d == "asc")
    .unwrap_or(true);
  let (data, total) = match dispatch_provider!(entry, provider => {
      let total = provider.count(&collection, filter.as_ref()).await.map_err_string()?;
      let data = provider
          .find_many(&collection, filter.as_ref(), skip.map(|s| s as u64), limit.map(|l| l as u64), sort_by, sort_asc)
          .await
          .map_err_string()?;
      Ok::<_, String>((data, total))
  }) {
    Ok(r) => r,
    Err(e) => {
      log::error!("Query error, returning empty result: {}", e);
      (vec![], 0)
    }
  };
  let has_more = if let (Some(_skip), Some(limit)) = (skip, limit) {
    data.len() as i64 >= limit
  } else {
    false
  };
  let result = QueryResult {
    data,
    total: total as i64,
    has_more,
  };
  timer.finish_success();
  Ok(Response::success("Query executed", result))
}
#[tauri::command(rename_all = "camelCase")]
pub async fn query_save(
  connectionId: String,
  collection: String,
  data: Value,
) -> Result<Response, String> {
  let timer = DataflowTimer::new("query_save");
  let params_log =
    serde_json::json!({ "connectionId": &connectionId, "collection": &collection, "data": &data });
  if let Err(e) = validate_conn_id(&connectionId) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&connectionId).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  let result: Value = match dispatch_provider!(entry, provider => {
      let value = if let Some(id) = data.get("id").and_then(|v| v.as_str()) {
          if provider.exists(&collection, id).await.map_err_string()? {
              provider.update(&collection, id, data.clone()).await.map_err_string()?
          } else {
              provider.insert(&collection, data).await.map_err_string()?
          }
      } else {
          provider.insert(&collection, data).await.map_err_string()?
      };
      Ok::<_, String>(value)
  }) {
    Ok(r) => r,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  timer.finish_success();
  Ok(Response::success("", result))
}
#[tauri::command(rename_all = "camelCase")]
pub async fn query_delete(
  connectionId: String,
  collection: String,
  id: String,
) -> Result<(), String> {
  let timer = DataflowTimer::new("query_delete");
  let params_log =
    serde_json::json!({ "connectionId": &connectionId, "collection": &collection, "id": &id });
  if let Err(e) = validate_conn_id(&connectionId) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&connectionId).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  match dispatch_provider!(entry, provider => {
      provider.delete(&collection, &id).await.map_err_string()
  }) {
    Ok(_) => {}
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  }
  timer.finish_success();
  Ok(())
}
#[tauri::command(rename_all = "camelCase")]
pub async fn query_raw(connectionId: String, sql: String) -> Result<RawResult, String> {
  let timer = DataflowTimer::new("query_raw");
  let params_log = serde_json::json!({ "connectionId": &connectionId, "sql": &sql });
  if let Err(e) = validate_conn_id(&connectionId) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&connectionId).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  let result = match dispatch_provider!(entry, provider => {
      let result = provider.execute_raw(&sql, vec![]).await.map_err_string()?;
      Ok::<_, String>(RawResult {
          columns: result.columns,
          rows: result.rows,
          affected_rows: result.affected_rows,
      })
  }) {
    Ok(r) => r,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  timer.finish_success();
  Ok(result)
}
#[tauri::command(rename_all = "camelCase")]
pub async fn query_server_version(connectionId: String) -> Result<String, String> {
  let timer = DataflowTimer::new("query_server_version");
  let params_log = serde_json::json!({ "connectionId": &connectionId });
  if let Err(e) = validate_conn_id(&connectionId) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&connectionId).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  let result = match &entry.config.config {
    ConnectionConfigEnum::Json { .. } => Ok("JSON Provider (local file)".to_string()),
    ConnectionConfigEnum::Mongo { .. } => Ok("MongoDB".to_string()),
    ConnectionConfigEnum::Redis { .. } => Ok("Redis".to_string()),
    ConnectionConfigEnum::Postgres { .. } => {
      match dispatch_provider!(entry, provider => {
          provider.get_server_version().await.map_err_string()
      }) {
        Ok(r) => Ok(r),
        Err(e) => {
          timer.clone().finish_error(&e);
          return Err(e);
        }
      }
    }
    ConnectionConfigEnum::Sqlite { .. } => Ok("SQLite".to_string()),
    ConnectionConfigEnum::MySql { .. } => {
      match dispatch_provider!(entry, provider => {
          provider.get_server_version().await.map_err_string()
      }) {
        Ok(r) => Ok(r),
        Err(e) => {
          timer.clone().finish_error(&e);
          return Err(e);
        }
      }
    }
  };
  timer.finish_success();
  result
}
