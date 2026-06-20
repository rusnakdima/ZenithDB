use crate::commands::validate_conn_id;
use crate::models::response::{Response, ResponseModel};
use crate::state::AppState;
use crate::utils::metrics::{redact_sensitive_data, DataflowTimer};
use serde_json::Value;
use tauri::State;
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ts_rs::TS)]
#[serde(tag = "type")]
pub enum ConnectionConfigEnum {
  Json {
    name: String,
    path: String,
  },
  Mongo {
    name: String,
    uri: String,
    database: String,
  },
  Redis {
    name: String,
    uri: String,
    #[serde(default)]
    database: String,
  },
  Postgres {
    name: String,
    uri: String,
  },
  Sqlite {
    name: String,
    path: String,
  },
  MySql {
    name: String,
    uri: String,
  },
}
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ts_rs::TS)]
pub struct ConnectionConfig {
  pub name: String,
  pub config: ConnectionConfigEnum,
}
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConnectionSummary {
  pub id: String,
  pub name: String,
  pub provider: String,
  pub status: String,
}
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConnectionHealth {
  pub healthy: bool,
  pub provider: String,
  pub server_version: Option<String>,
  pub latency_ms: Option<u64>,
}
impl ConnectionHealth {
  pub fn ok(provider: &str) -> Self {
    Self {
      healthy: true,
      provider: provider.to_string(),
      server_version: None,
      latency_ms: None,
    }
  }
  pub fn err(msg: &str) -> Self {
    Self {
      healthy: false,
      provider: String::new(),
      server_version: Some(msg.to_string()),
      latency_ms: None,
    }
  }
}
#[tauri::command]
pub async fn save_connection(
  state: State<'_, AppState>,
  config: ConnectionConfig,
) -> Result<Response, String> {
  let timer = DataflowTimer::new("save_connection");
  let params = serde_json::json!({ "config": &config });
  match state.connection_service.save_connection(config).await {
    Ok(r) => {
      timer.finish_success();
      Ok(r)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command]
pub async fn list_connections(state: State<'_, AppState>) -> Result<Response, String> {
  let timer = DataflowTimer::new("list_connections");
  match state.connection_service.list_connections().await {
    Ok(r) => {
      timer.finish_success();
      Ok(r)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command]
pub async fn test_connection_status(
  state: State<'_, AppState>,
  id: &str,
) -> Result<Response, String> {
  let timer = DataflowTimer::new("test_connection_status");
  if let Err(e) = validate_conn_id(id) {
    timer.finish_error(&e);
    return Err(e);
  }
  let params = serde_json::json!({ "id": id });
  match state.connection_service.test_connection_status(id).await {
    Ok(r) => {
      timer.finish_success();
      Ok(r)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command(rename_all = "camelCase")]
pub async fn check_health(
  state: State<'_, AppState>,
  connection_id: &str,
) -> Result<Response, String> {
  let timer = DataflowTimer::new("check_health");
  if let Err(e) = validate_conn_id(connection_id) {
    timer.finish_error(&e);
    return Err(e);
  }
  let params = serde_json::json!({ "connection_id": connection_id });
  match state.connection_service.check_health(connection_id).await {
    Ok(r) => {
      timer.finish_success();
      Ok(r)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command]
pub async fn delete_connection(state: State<'_, AppState>, id: &str) -> Result<Response, String> {
  let timer = DataflowTimer::new("delete_connection");
  if let Err(e) = validate_conn_id(id) {
    timer.finish_error(&e);
    return Err(e);
  }
  let params = serde_json::json!({ "id": id });
  match state.connection_service.delete_connection(id).await {
    Ok(r) => {
      timer.finish_success();
      Ok(r)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command]
pub async fn update_connection(
  state: State<'_, AppState>,
  id: &str,
  config: ConnectionConfig,
) -> Result<Response, String> {
  let timer = DataflowTimer::new("update_connection");
  if let Err(e) = validate_conn_id(id) {
    timer.finish_error(&e);
    return Err(e);
  }
  let params = serde_json::json!({ "id": id, "config": &config });
  match state.connection_service.update_connection(id, config).await {
    Ok(r) => {
      timer.finish_success();
      Ok(r)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command]
pub async fn get_connection(state: State<'_, AppState>, id: &str) -> Result<Response, String> {
  let timer = DataflowTimer::new("get_connection");
  if let Err(e) = validate_conn_id(id) {
    timer.finish_error(&e);
    return Err(e);
  }
  let params = serde_json::json!({ "id": id });
  match state.connection_service.get_connection(id).await {
    Ok(r) => {
      timer.finish_success();
      Ok(r)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command]
pub async fn test_connection(
  state: State<'_, AppState>,
  config: ConnectionConfig,
) -> Result<Response, String> {
  let timer = DataflowTimer::new("test_connection");
  let params = serde_json::json!({ "config": &config });
  match state.connection_service.test_connection(config).await {
    Ok(r) => {
      timer.finish_success();
      Ok(r)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
