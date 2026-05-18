use crate::commands::connection::{
  check_provider_health, ConnectionConfig, ConnectionConfigResult, ConnectionHealth, ConnectionId,
  ConnectionSummary,
};
use crate::commands::connections_db::ConnectionsDb;
use crate::commands::validate_conn_id;

#[tauri::command]
pub async fn connection_list() -> Result<Vec<ConnectionSummary>, String> {
  let db = ConnectionsDb::new()?;
  db.init()?;
  let entities = db.find_all()?;
  let summaries = entities
    .into_iter()
    .map(|e| ConnectionSummary {
      id: e.id,
      name: e.name,
      provider: e.type_.to_lowercase(),
      status: "unknown".to_string(),
    })
    .collect();
  Ok(summaries)
}

#[tauri::command]
pub async fn connection_get(id: String) -> Result<ConnectionConfigResult, String> {
  validate_conn_id(&id)?;
  let db = ConnectionsDb::new()?;
  db.init()?;
  let entity = db
    .find_by_id(&id)?
    .ok_or_else(|| format!("Connection {} not found", id))?;
  Ok(ConnectionConfigResult {
    id: entity.id,
    config: entity.config,
  })
}

#[tauri::command]
pub async fn connection_create(config: ConnectionConfig) -> Result<ConnectionId, String> {
  crate::commands::connection::save_connection(config).await
}

#[tauri::command]
pub async fn connection_update(id: String, config: ConnectionConfig) -> Result<(), String> {
  validate_conn_id(&id)?;
  crate::commands::connection::update_connection(&id, config).await
}

#[tauri::command]
pub async fn connection_delete(id: String) -> Result<(), String> {
  validate_conn_id(&id)?;
  crate::commands::connection::delete_connection(&id).await
}

#[tauri::command]
pub async fn connection_test(config: ConnectionConfig) -> Result<ConnectionHealth, String> {
  Ok(check_provider_health(&config).await)
}

#[tauri::command]
pub async fn connection_test_status(id: String) -> Result<ConnectionSummary, String> {
  validate_conn_id(&id)?;
  crate::commands::connection::test_connection_status(&id).await
}
