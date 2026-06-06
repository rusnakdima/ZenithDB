use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::types::RawResult;
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
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

#[tauri::command]
pub async fn query_execute(
  conn_id: String,
  collection: String,
  params: QueryParams,
) -> Result<QueryResult, String> {
  validate_conn_id(&conn_id)?;
  validate_name(&collection)?;
  let entry = get_connection_entry(&conn_id).await?;
  let filter = parse_filter(params.filter)?;
  let skip = params.skip;
  let limit = params.limit;
  let sort_by = params.order_by.as_deref();
  let sort_asc = params.direction.as_deref() != Some("desc");

  let (data, total) = dispatch_provider!(entry, provider => {
      let total = provider.count(&collection, filter.as_ref()).await.map_err_string()?;
      let data = provider
          .find_many(&collection, filter.as_ref(), skip, limit, sort_by, sort_asc)
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
}

#[tauri::command]
pub async fn query_save(conn_id: String, collection: String, data: Value) -> Result<Value, String> {
  validate_conn_id(&conn_id)?;
  validate_name(&collection)?;
  let entry = get_connection_entry(&conn_id).await?;
  dispatch_provider!(entry, provider => {
      if let Some(id) = data.get("id").and_then(|v| v.as_str()) {
          if provider.exists(&collection, id).await.map_err_string()? {
              return provider.update(&collection, id, data.clone()).await.map_err_string();
          }
      }
      provider.insert(&collection, data).await.map_err_string()
  })
}

#[tauri::command]
pub async fn query_delete(conn_id: String, collection: String, id: String) -> Result<(), String> {
  validate_conn_id(&conn_id)?;
  validate_name(&collection)?;
  let entry = get_connection_entry(&conn_id).await?;
  dispatch_provider!(entry, provider => {
      provider.delete(&collection, &id).await.map_err_string()?;
      Ok(())
  })
}

#[tauri::command]
pub async fn query_raw(conn_id: String, sql: String) -> Result<RawResult, String> {
  validate_conn_id(&conn_id)?;
  validate_sql(&sql)?;
  let entry = get_connection_entry(&conn_id).await?;
  dispatch_provider!(entry, provider => {
      let result = provider.execute_raw(&sql, vec![]).await.map_err_string()?;
      Ok(RawResult {
          columns: result.columns,
          rows: result.rows,
          affected_rows: result.affected_rows,
      })
  })
}

#[tauri::command]
pub async fn query_server_version(conn_id: String) -> Result<String, String> {
  validate_conn_id(&conn_id)?;
  let entry = get_connection_entry(&conn_id).await?;
  match &entry.config.config {
    ConnectionConfigEnum::Json { .. } => Ok("JSON Provider (local file)".to_string()),
    ConnectionConfigEnum::Mongo { .. } => Ok("MongoDB".to_string()),
    ConnectionConfigEnum::Redis { .. } => Ok("Redis".to_string()),
    ConnectionConfigEnum::Postgres { .. } => {
      dispatch_provider!(entry, provider => {
          provider.get_server_version().await.map_err_string()
      })
    }
    ConnectionConfigEnum::Sqlite { .. } => Ok("SQLite".to_string()),
    ConnectionConfigEnum::MySql { .. } => {
      dispatch_provider!(entry, provider => {
          provider.get_server_version().await.map_err_string()
      })
    }
  }
}
