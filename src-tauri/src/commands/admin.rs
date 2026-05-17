use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::{validate_conn_id, validate_name};
use crate::dispatch_provider;
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawResult {
  pub columns: Vec<String>,
  pub rows: Vec<Vec<Value>>,
  pub affected_rows: u64,
}

#[tauri::command]
pub async fn create_collection(connId: &str, name: &str) -> Result<(), String> {
  validate_conn_id(connId)?;
  validate_name(name)?;
  let entry = get_connection_entry(connId).await?;
  dispatch_provider!(entry, provider => {
      provider.create_collection(name, None).await.map_err_string()
  })
}

#[tauri::command]
pub async fn drop_collection(connId: &str, name: &str) -> Result<(), String> {
  validate_conn_id(connId)?;
  validate_name(name)?;
  let entry = get_connection_entry(connId).await?;
  dispatch_provider!(entry, provider => {
      provider.drop_collection(name).await.map_err_string()
  })
}

#[tauri::command]
pub async fn rename_collection(connId: &str, oldName: &str, newName: &str) -> Result<(), String> {
  validate_conn_id(connId)?;
  validate_name(oldName)?;
  validate_name(newName)?;
  let entry = get_connection_entry(connId).await?;
  dispatch_provider!(entry, provider => {
      let data = provider.find_many(oldName, None, None, None, None, true).await.map_err_string()?;
      for item in data {
        provider.insert(newName, item.clone()).await.map_err_string()?;
      }
      provider.drop_collection(oldName).await.map_err_string()
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
pub async fn execute_raw(connId: &str, sql: &str) -> Result<RawResult, String> {
  validate_conn_id(connId)?;
  validate_sql(sql)?;
  let entry = get_connection_entry(connId).await?;
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
pub async fn get_server_version(connId: &str) -> Result<String, String> {
  validate_conn_id(connId)?;
  let entry = get_connection_entry(connId).await?;
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
