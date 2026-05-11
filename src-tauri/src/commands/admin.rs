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

const BLOCKED_SQL_PATTERNS: &[&str] = &[
  "DROP", "TRUNCATE", "ALTER", "CREATE", "GRANT", "REVOKE", "EXEC", "EXECUTE",
];

fn normalize_sql(sql: &str) -> String {
  let mut result = sql.to_string();
  while let Some(start) = result.find("/*") {
    if let Some(end) = result[start..].find("*/") {
      result = format!("{}{}", &result[..start], &result[start + end + 2..]);
    } else {
      result = result[..start].to_string();
      break;
    }
  }
  result = result.split("--").next().unwrap_or(&result).to_string();
  let result = result.split_whitespace().collect::<Vec<_>>().join(" ");
  result.trim().to_string()
}

fn validate_sql(sql: &str) -> Result<(), String> {
  let normalized = normalize_sql(sql);
  let upper_sql = normalized.to_uppercase();

  for pattern in BLOCKED_SQL_PATTERNS {
    if upper_sql.contains(pattern) {
      tracing::warn!("Blocked SQL execution with dangerous pattern: {}", pattern);
      return Err(format!(
        "SQL statement containing '{}' is not allowed",
        pattern.trim()
      ));
    }
  }

  if upper_sql.starts_with("DELETE") && !upper_sql.contains("WHERE") {
    tracing::warn!("Blocked DELETE without WHERE clause");
    return Err("DELETE without WHERE clause is not allowed".to_string());
  }

  Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawResult {
  pub columns: Vec<String>,
  pub rows: Vec<Vec<Value>>,
  pub affected_rows: u64,
}

#[tauri::command]
pub async fn execute_raw(conn_id: &str, sql: &str) -> Result<RawResult, String> {
  check_rate_limit(conn_id).await?;
  validate_query_size(sql)?;
  validate_sql(sql)?;
  tracing::info!("Executing raw SQL on connection {}: {}", conn_id, sql);
  let entry = get_connection_entry(conn_id).await?;

  record_query(async {
    dispatch_provider!(entry, provider => {
        let result = provider.execute_raw(sql, vec![]).await.map_err_string()?;
        Ok(RawResult {
            columns: result.columns,
            rows: result.rows,
            affected_rows: result.affected_rows,
        })
    })
  })
  .await
}

#[tauri::command]
pub async fn get_server_version(conn_id: &str) -> Result<String, String> {
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
