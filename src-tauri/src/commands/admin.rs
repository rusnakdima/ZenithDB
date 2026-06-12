use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::types::RawResult;
use crate::commands::{validate_conn_id, validate_name};
use crate::dispatch_provider;
use crate::logger::{redact_sensitive_data, DataflowTimer};
use crate::models::response::ResponseModel;
use nosql_orm::prelude::*;

#[tauri::command]
pub async fn create_collection(connId: &str, name: &str) -> Result<(), String> {
  let timer = DataflowTimer::new("create_collection");
  let params = serde_json::json!({ "connId": connId, "name": name });
  tracing::debug!(command = "create_collection", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  if let Err(e) = validate_conn_id(connId) {
    timer.finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(name) {
    timer.finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(connId).await {
    Ok(e) => e,
    Err(e) => {
      timer.finish_error(&e);
      return Err(e);
    }
  };
  match dispatch_provider!(entry, provider => {
      provider.create_collection(name, None).await.map_err_string()
  }) {
    Ok(_) => {}
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  }
  timer.finish(&ResponseModel::success(()));
  Ok(())
}

#[tauri::command]
pub async fn drop_collection(connId: &str, name: &str) -> Result<(), String> {
  let timer = DataflowTimer::new("drop_collection");
  let params = serde_json::json!({ "connId": connId, "name": name });
  tracing::debug!(command = "drop_collection", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  if let Err(e) = validate_conn_id(connId) {
    timer.finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(name) {
    timer.finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(connId).await {
    Ok(e) => e,
    Err(e) => {
      timer.finish_error(&e);
      return Err(e);
    }
  };
  match dispatch_provider!(entry, provider => {
      provider.drop_collection(name).await.map_err_string()
  }) {
    Ok(_) => {}
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  }
  timer.finish(&ResponseModel::success(()));
  Ok(())
}

#[tauri::command]
pub async fn rename_collection(connId: &str, old_name: &str, new_name: &str) -> Result<(), String> {
  let timer = DataflowTimer::new("rename_collection");
  let params = serde_json::json!({ "connId": connId, "old_name": old_name, "new_name": new_name });
  tracing::debug!(command = "rename_collection", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  if let Err(e) = validate_conn_id(connId) {
    timer.finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(old_name) {
    timer.finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(new_name) {
    timer.finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(connId).await {
    Ok(e) => e,
    Err(e) => {
      timer.finish_error(&e);
      return Err(e);
    }
  };
  match dispatch_provider!(entry, provider => {
      let data = provider.find_many(old_name, None, None, None, None, true).await.map_err_string()?;
      for item in data {
        provider.insert(new_name, item.clone()).await.map_err_string()?;
      }
      provider.drop_collection(old_name).await.map_err_string()
  }) {
    Ok(_) => {}
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  }
  timer.finish(&ResponseModel::success(()));
  Ok(())
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
  let timer = DataflowTimer::new("execute_raw");
  let params = serde_json::json!({ "connId": connId, "sql": sql });
  tracing::debug!(command = "execute_raw", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  if let Err(e) = validate_conn_id(connId) {
    timer.finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_sql(sql) {
    timer.finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(connId).await {
    Ok(e) => e,
    Err(e) => {
      timer.finish_error(&e);
      return Err(e);
    }
  };
  let result = dispatch_provider!(entry, provider => {
      let result = provider.execute_raw(sql, vec![]).await.map_err_string()?;
      Ok::<RawResult, String>(RawResult {
          columns: result.columns,
          rows: result.rows,
          affected_rows: result.affected_rows,
      })
  });
  match result {
    Ok(r) => {
      timer.finish(&ResponseModel::success(&r));
      Ok(r)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}

#[tauri::command]
pub async fn get_server_version(connId: &str) -> Result<String, String> {
  let timer = DataflowTimer::new("get_server_version");
  let params = serde_json::json!({ "connId": connId });
  tracing::debug!(command = "get_server_version", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  if let Err(e) = validate_conn_id(connId) {
    timer.finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(connId).await {
    Ok(e) => e,
    Err(e) => {
      timer.finish_error(&e);
      return Err(e);
    }
  };
  let version = match &entry.config.config {
    ConnectionConfigEnum::Json { .. } => "JSON Provider (local file)".to_string(),
    ConnectionConfigEnum::Mongo { .. } => "MongoDB".to_string(),
    ConnectionConfigEnum::Redis { .. } => "Redis".to_string(),
    ConnectionConfigEnum::Postgres { .. } => {
      match dispatch_provider!(entry, provider => {
          provider.get_server_version().await.map_err_string()
      }) {
        Ok(v) => v,
        Err(e) => {
          timer.finish_error(&e);
          return Err(e);
        }
      }
    }
    ConnectionConfigEnum::Sqlite { .. } => "SQLite".to_string(),
    ConnectionConfigEnum::MySql { .. } => {
      match dispatch_provider!(entry, provider => {
          provider.get_server_version().await.map_err_string()
      }) {
        Ok(v) => v,
        Err(e) => {
          timer.finish_error(&e);
          return Err(e);
        }
      }
    }
  };
  timer.finish(&ResponseModel::success(&version));
  Ok(version)
}
