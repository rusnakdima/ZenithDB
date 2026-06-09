use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::types::RawResult;
use crate::commands::{validate_conn_id, validate_name};
use crate::dispatch_provider;
use nosql_orm::prelude::*;

#[tauri::command]
pub async fn create_collection(conn_id: &str, name: &str) -> Result<(), String> {
  validate_conn_id(conn_id)?;
  validate_name(name)?;
  let entry = get_connection_entry(conn_id).await?;
  dispatch_provider!(entry, provider => {
      provider.create_collection(name, None).await.map_err_string()
  })
}

#[tauri::command]
pub async fn drop_collection(conn_id: &str, name: &str) -> Result<(), String> {
  validate_conn_id(conn_id)?;
  validate_name(name)?;
  let entry = get_connection_entry(conn_id).await?;
  dispatch_provider!(entry, provider => {
      provider.drop_collection(name).await.map_err_string()
  })
}

#[tauri::command]
pub async fn rename_collection(
  conn_id: &str,
  old_name: &str,
  new_name: &str,
) -> Result<(), String> {
  validate_conn_id(conn_id)?;
  validate_name(old_name)?;
  validate_name(new_name)?;
  let entry = get_connection_entry(conn_id).await?;
  dispatch_provider!(entry, provider => {
      let data = provider.find_many(old_name, None, None, None, None, true).await.map_err_string()?;
      for item in data {
        provider.insert(new_name, item.clone()).await.map_err_string()?;
      }
      provider.drop_collection(old_name).await.map_err_string()
  })
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
pub async fn execute_raw(conn_id: &str, sql: &str) -> Result<RawResult, String> {
  validate_conn_id(conn_id)?;
  validate_sql(sql)?;
  let entry = get_connection_entry(conn_id).await?;
  dispatch_provider!(entry, provider => {
      let result = provider.execute_raw(sql, vec![]).await.map_err_string()?;
      Ok(RawResult {
          columns: result.columns,
          rows: result.rows,
          affected_rows: result.affected_rows,
      })
  })
}

#[tauri::command]
pub async fn get_server_version(conn_id: &str) -> Result<String, String> {
  validate_conn_id(conn_id)?;
  let entry = get_connection_entry(conn_id).await?;
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
