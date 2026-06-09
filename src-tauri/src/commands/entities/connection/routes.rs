use crate::commands::connection::ConnectionConfig;
use crate::commands::validate_conn_id;
use crate::models::response::ResponseModel;
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn connection_list(state: State<'_, AppState>) -> Result<ResponseModel, ResponseModel> {
  state.connection_service.list_connections().await
}

#[tauri::command]
pub async fn connection_get(
  state: State<'_, AppState>,
  id: String,
) -> Result<ResponseModel, ResponseModel> {
  validate_conn_id(&id).map_err(|e| ResponseModel::error(e))?;
  state.connection_service.get_connection(&id).await
}

#[tauri::command]
pub async fn connection_create(
  state: State<'_, AppState>,
  config: ConnectionConfig,
) -> Result<ResponseModel, ResponseModel> {
  state.connection_service.save_connection(config).await
}

#[tauri::command]
pub async fn connection_update(
  state: State<'_, AppState>,
  id: String,
  config: ConnectionConfig,
) -> Result<ResponseModel, ResponseModel> {
  validate_conn_id(&id).map_err(|e| ResponseModel::error(e))?;
  state
    .connection_service
    .update_connection(&id, config)
    .await
}

#[tauri::command]
pub async fn connection_delete(
  state: State<'_, AppState>,
  id: String,
) -> Result<ResponseModel, ResponseModel> {
  validate_conn_id(&id).map_err(|e| ResponseModel::error(e))?;
  state.connection_service.delete_connection(&id).await
}

#[tauri::command]
pub async fn connection_test(
  state: State<'_, AppState>,
  config: ConnectionConfig,
) -> Result<ResponseModel, ResponseModel> {
  state.connection_service.test_connection(config).await
}

#[tauri::command]
pub async fn connection_test_status(
  state: State<'_, AppState>,
  id: String,
) -> Result<ResponseModel, ResponseModel> {
  validate_conn_id(&id).map_err(|e| ResponseModel::error(e))?;
  state.connection_service.test_connection_status(&id).await
}
