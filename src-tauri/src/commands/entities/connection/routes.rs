use crate::commands::connection::{
  check_provider_health, get_connection_type, ConnectionConfig, ConnectionConfigResult,
  ConnectionEntry, ConnectionHealth, ConnectionId, ConnectionStore, ConnectionSummary,
};
use crate::commands::validate_conn_id;

#[tauri::command]
pub async fn connection_list() -> Result<Vec<ConnectionSummary>, String> {
  let store = ConnectionStore::load_or_default().await;
  let mut summaries = Vec::new();
  for c in store.connections.iter() {
    summaries.push(ConnectionSummary {
      id: c.id.clone(),
      name: c.config.name.clone(),
      provider: get_connection_type(&c.config).to_string(),
      status: "unknown".to_string(),
    });
  }
  Ok(summaries)
}

#[tauri::command]
pub async fn connection_get(id: String) -> Result<ConnectionConfigResult, String> {
  validate_conn_id(&id)?;
  let store = ConnectionStore::load_or_default().await;
  let entry = store
    .find_by_id(&id)
    .ok_or_else(|| format!("Connection {} not found", id))?;
  Ok(ConnectionConfigResult {
    id: entry.id.clone(),
    config: entry.config.clone(),
  })
}

#[tauri::command]
pub async fn connection_create(config: ConnectionConfig) -> Result<ConnectionId, String> {
  let id = uuid::Uuid::new_v4().to_string();
  let entry = ConnectionEntry {
    id: id.clone(),
    config,
  };

  let mut store = ConnectionStore::load_or_default().await;
  store.add_connection(entry);
  store.save().await?;
  Ok(id)
}

#[tauri::command]
pub async fn connection_update(id: String, config: ConnectionConfig) -> Result<(), String> {
  validate_conn_id(&id)?;
  let mut store = ConnectionStore::load_or_default().await;
  let _entry = store
    .find_by_id(&id)
    .ok_or_else(|| format!("Connection {} not found", id))?;

  let updated_entry = ConnectionEntry {
    id: id.to_string(),
    config,
  };

  store.remove_connection(&id);
  store.add_connection(updated_entry);
  store.save().await?;
  Ok(())
}

#[tauri::command]
pub async fn connection_delete(id: String) -> Result<(), String> {
  validate_conn_id(&id)?;
  let mut store = ConnectionStore::load_or_default().await;
  if store.remove_connection(&id) {
    store.save().await?;
  } else {
    return Err(format!("Connection {} not found", id));
  }
  Ok(())
}

#[tauri::command]
pub async fn connection_test(config: ConnectionConfig) -> Result<ConnectionHealth, String> {
  Ok(check_provider_health(&config).await)
}

#[tauri::command]
pub async fn connection_test_status(id: String) -> Result<ConnectionSummary, String> {
  validate_conn_id(&id)?;
  let store = ConnectionStore::load().await.map_err(|e| e.to_string())?;
  let entry = store
    .find_by_id(&id)
    .ok_or_else(|| format!("Connection {} not found", id))?;

  let health = check_provider_health(&entry.config).await;
  let status = if health.healthy {
    "connected".to_string()
  } else {
    "disconnected".to_string()
  };

  Ok(ConnectionSummary {
    id: entry.id.clone(),
    name: entry.config.name.clone(),
    provider: get_connection_type(&entry.config).to_string(),
    status,
  })
}
