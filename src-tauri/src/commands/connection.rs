use crate::commands::get_auth_context;
use crate::commands::validate_conn_id;
use crate::models::response::ResponseModel;
use crate::state::AppState;
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
) -> Result<ResponseModel, ResponseModel> {
  let auth = get_auth_context();
  if !auth.can_access_connection("*") {
    return Err(ResponseModel::error("Access denied"));
  }
  state.connection_service.save_connection(config).await
}

#[tauri::command]
pub async fn list_connections(state: State<'_, AppState>) -> Result<ResponseModel, ResponseModel> {
  let auth = get_auth_context();
  if !auth.can_access_connection("*") {
    return Err(ResponseModel::error("Access denied"));
  }
  state.connection_service.list_connections().await
}

#[tauri::command]
pub async fn test_connection_status(
  state: State<'_, AppState>,
  id: &str,
) -> Result<ResponseModel, ResponseModel> {
  let auth = get_auth_context();
  if !auth.can_access_connection(id) {
    return Err(ResponseModel::error("Access denied to connection"));
  }
  validate_conn_id(id).map_err(|e| ResponseModel::error(e))?;
  state.connection_service.test_connection_status(id).await
}

#[tauri::command]
pub async fn check_health(
  state: State<'_, AppState>,
  conn_id: &str,
) -> Result<ResponseModel, ResponseModel> {
  let auth = get_auth_context();
  if !auth.can_access_connection(conn_id) {
    return Err(ResponseModel::error("Access denied to connection"));
  }
  validate_conn_id(conn_id).map_err(|e| ResponseModel::error(e))?;
  state.connection_service.check_health(conn_id).await
}

#[tauri::command]
pub async fn delete_connection(
  state: State<'_, AppState>,
  id: &str,
) -> Result<ResponseModel, ResponseModel> {
  let auth = get_auth_context();
  if !auth.can_access_connection(id) {
    return Err(ResponseModel::error("Access denied to connection"));
  }
  validate_conn_id(id).map_err(|e| ResponseModel::error(e))?;
  state.connection_service.delete_connection(id).await
}

#[tauri::command]
pub async fn update_connection(
  state: State<'_, AppState>,
  id: &str,
  config: ConnectionConfig,
) -> Result<ResponseModel, ResponseModel> {
  let auth = get_auth_context();
  if !auth.can_access_connection(id) {
    return Err(ResponseModel::error("Access denied to connection"));
  }
  validate_conn_id(id).map_err(|e| ResponseModel::error(e))?;
  state.connection_service.update_connection(id, config).await
}

#[tauri::command]
pub async fn get_connection(
  state: State<'_, AppState>,
  id: &str,
) -> Result<ResponseModel, ResponseModel> {
  let auth = get_auth_context();
  if !auth.can_access_connection(id) {
    return Err(ResponseModel::error("Access denied to connection"));
  }
  validate_conn_id(id).map_err(|e| ResponseModel::error(e))?;
  state.connection_service.get_connection(id).await
}

#[tauri::command]
pub async fn test_connection(
  state: State<'_, AppState>,
  config: ConnectionConfig,
) -> Result<ResponseModel, ResponseModel> {
  state.connection_service.test_connection(config).await
}
