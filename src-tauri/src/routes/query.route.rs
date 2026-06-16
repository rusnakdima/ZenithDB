use crate::dispatch_provider;
use crate::logger::{redact_sensitive_data, DataflowTimer};
use crate::models::response::ResponseModel;
use crate::routes::connection_command::ConnectionConfigEnum;
use crate::routes::error_utils::ToStringError;
use crate::routes::get_connection_entry;
use crate::routes::types::RawResult;
use crate::routes::validate_conn_id;
use crate::routes::validate_name;
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
  connection_id: String,
  collection: String,
  params: QueryParams,
) -> Result<QueryResult<Value>, String> {
  let timer = DataflowTimer::new("query_execute");
  let params_log = serde_json::json!({ "connection_id": &connection_id, "collection": &collection, "params": &params });
  log::debug!(
    "command = query_execute, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params_log).unwrap_or_default())
  );
  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&connection_id).await {
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
  let sort_asc = true;

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
      timer.clone().finish_error(&e);
      return Err(e);
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
  timer.finish(&ResponseModel::success(&result));
  Ok(result)
}

#[tauri::command]
pub async fn query_save(
  connection_id: String,
  collection: String,
  data: Value,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("query_save");
  let params_log = serde_json::json!({ "connection_id": &connection_id, "collection": &collection, "data": &data });
  log::debug!(
    "command = query_save, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params_log).unwrap_or_default())
  );
  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  let entry = match get_connection_entry(&connection_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(ResponseModel::error(e));
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
      return Err(ResponseModel::error(e));
    }
  };
  timer.finish(&ResponseModel::success(&result));
  Ok(ResponseModel::success(result))
}

#[tauri::command]
pub async fn query_delete(
  connection_id: String,
  collection: String,
  id: String,
) -> Result<(), String> {
  let timer = DataflowTimer::new("query_delete");
  let params_log =
    serde_json::json!({ "connection_id": &connection_id, "collection": &collection, "id": &id });
  log::debug!(
    "command = query_delete, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params_log).unwrap_or_default())
  );
  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&connection_id).await {
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
  timer.finish(&ResponseModel::success(()));
  Ok(())
}

#[tauri::command]
pub async fn query_raw(connection_id: String, sql: String) -> Result<RawResult, String> {
  let timer = DataflowTimer::new("query_raw");
  let params_log = serde_json::json!({ "connection_id": &connection_id, "sql": &sql });
  log::debug!(
    "command = query_raw, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params_log).unwrap_or_default())
  );
  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_sql(&sql) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&connection_id).await {
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
  timer.finish(&ResponseModel::success(&result));
  Ok(result)
}

#[tauri::command]
pub async fn query_server_version(connection_id: String) -> Result<String, String> {
  let timer = DataflowTimer::new("query_server_version");
  let params_log = serde_json::json!({ "connection_id": &connection_id });
  log::debug!(
    "command = query_server_version, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params_log).unwrap_or_default())
  );
  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&connection_id).await {
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
  timer.finish(&ResponseModel::success(&result));
  result
}
