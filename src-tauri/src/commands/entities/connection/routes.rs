use crate::commands::connection::ConnectionConfig;
use crate::commands::validate_conn_id;
use crate::logger::{redact_sensitive_data, DataflowTimer};
use crate::models::response::ResponseModel;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn connection_list(state: State<'_, AppState>) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("connection_list");
  tracing::debug!(command = "connection_list", "[COMMAND_ENTRY]");
  let result = state.connection_service.list_connections().await;
  match &result {
    Ok(r) => timer.finish(r),
    Err(e) => timer.finish_error(&e.message),
  }
  result
}

#[tauri::command]
pub async fn connection_get(
  state: State<'_, AppState>,
  id: String,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("connection_get");
  let params = serde_json::json!({ "id": &id });
  tracing::debug!(command = "connection_get", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  if let Err(e) = validate_conn_id(&id) {
    timer.finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  let result = state.connection_service.get_connection(&id).await;
  match &result {
    Ok(r) => timer.finish(r),
    Err(e) => timer.finish_error(&e.message),
  }
  result
}

#[tauri::command]
pub async fn connection_create(
  state: State<'_, AppState>,
  config: ConnectionConfig,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("connection_create");
  let params = serde_json::json!({ "config": &config });
  tracing::debug!(command = "connection_create", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  let result = state.connection_service.save_connection(config).await;
  match &result {
    Ok(r) => timer.finish(r),
    Err(e) => timer.finish_error(&e.message),
  }
  result
}

#[tauri::command]
pub async fn connection_update(
  state: State<'_, AppState>,
  id: String,
  config: ConnectionConfig,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("connection_update");
  let params = serde_json::json!({ "id": &id, "config": &config });
  tracing::debug!(command = "connection_update", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  if let Err(e) = validate_conn_id(&id) {
    timer.finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  let result = state
    .connection_service
    .update_connection(&id, config)
    .await;
  match &result {
    Ok(r) => timer.finish(r),
    Err(e) => timer.finish_error(&e.message),
  }
  result
}

#[tauri::command]
pub async fn connection_delete(
  state: State<'_, AppState>,
  id: String,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("connection_delete");
  let params = serde_json::json!({ "id": &id });
  tracing::debug!(command = "connection_delete", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  if let Err(e) = validate_conn_id(&id) {
    timer.finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  let result = state.connection_service.delete_connection(&id).await;
  match &result {
    Ok(r) => timer.finish(r),
    Err(e) => timer.finish_error(&e.message),
  }
  result
}

#[tauri::command]
pub async fn connection_test(
  state: State<'_, AppState>,
  config: ConnectionConfig,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("connection_test");
  let params = serde_json::json!({ "config": &config });
  tracing::debug!(command = "connection_test", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  let result = state.connection_service.test_connection(config).await;
  match &result {
    Ok(r) => timer.finish(r),
    Err(e) => timer.finish_error(&e.message),
  }
  result
}

#[tauri::command]
pub async fn connection_test_status(
  state: State<'_, AppState>,
  id: String,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("connection_test_status");
  let params = serde_json::json!({ "id": &id });
  tracing::debug!(command = "connection_test_status", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  if let Err(e) = validate_conn_id(&id) {
    timer.finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  let result = state.connection_service.test_connection_status(&id).await;
  match &result {
    Ok(r) => timer.finish(r),
    Err(e) => timer.finish_error(&e.message),
  }
  result
}
