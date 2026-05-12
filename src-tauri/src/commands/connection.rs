use crate::commands::decentralization::delete_connection_databases_metadata;
use crate::commands::get_auth_context;
use crate::commands::provider::{
  create_json_provider, create_mongo_provider, create_mysql_provider, create_postgres_provider,
  create_redis_provider, create_sqlite_provider,
};
use crate::commands::validate_conn_id;
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;

pub type ConnectionId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ConnectionConfigEnum {
  Json {
    name: String,
    path: String,
    #[serde(default = "default_json_behavior")]
    behavior: String,
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

fn default_json_behavior() -> String {
  "folders_as_databases".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
  pub name: String,
  pub config: ConnectionConfigEnum,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionEntry {
  pub id: String,
  pub config: ConnectionConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionSummary {
  pub id: String,
  pub name: String,
  pub provider: String,
  pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionHealth {
  pub healthy: bool,
  pub provider: String,
  pub server_version: Option<String>,
  pub latency_ms: Option<u64>,
}

impl ConnectionHealth {
  fn ok(provider: &str) -> Self {
    Self {
      healthy: true,
      provider: provider.to_string(),
      server_version: None,
      latency_ms: None,
    }
  }
  fn err(msg: &str) -> Self {
    Self {
      healthy: false,
      provider: String::new(),
      server_version: Some(msg.to_string()),
      latency_ms: None,
    }
  }
}

pub struct ConnectionStore {
  pub connections: Vec<ConnectionEntry>,
  path: PathBuf,
}

impl ConnectionStore {
  pub fn path() -> PathBuf {
    dirs::home_dir()
      .unwrap_or_else(|| PathBuf::from("."))
      .join(".zenithdb")
      .join("connections.json")
  }

  pub async fn load() -> Result<Self, String> {
    let path = Self::path();
    if !path.exists() {
      return Ok(Self::default());
    }
    let content = tokio::fs::read_to_string(&path)
      .await
      .map_err(|e| format!("Failed to read connections: {}", e))?;
    let connections: Vec<ConnectionEntry> =
      serde_json::from_str(&content).map_err(|e| format!("Failed to parse connections: {}", e))?;
    Ok(Self { connections, path })
  }

  pub async fn save(&self) -> Result<(), String> {
    if let Some(parent) = self.path.parent() {
      fs::create_dir_all(parent)
        .await
        .map_err(|e| format!("Failed to create dir: {}", e))?;
    }
    let content = serde_json::to_string_pretty(&self.connections)
      .map_err(|e| format!("Failed to serialize: {}", e))?;
    tokio::fs::write(&self.path, content)
      .await
      .map_err(|e| format!("Failed to write connections: {}", e))?;
    Ok(())
  }

  pub async fn load_or_default() -> Self {
    match Self::load().await {
      Ok(store) => store,
      Err(_) => Self::default(),
    }
  }

  pub fn add_connection(&mut self, entry: ConnectionEntry) {
    self.connections.retain(|c| c.id != entry.id);
    self.connections.push(entry);
  }

  pub fn remove_connection(&mut self, id: &str) -> bool {
    let len = self.connections.len();
    self.connections.retain(|c| c.id != id);
    self.connections.len() < len
  }

  pub fn find_by_id(&self, id: &str) -> Option<&ConnectionEntry> {
    self.connections.iter().find(|c| c.id == id)
  }
}

impl Default for ConnectionStore {
  fn default() -> Self {
    Self {
      connections: Vec::new(),
      path: Self::path(),
    }
  }
}

pub fn get_connection_type(config: &ConnectionConfig) -> &'static str {
  match config.config {
    ConnectionConfigEnum::Json { .. } => "json",
    ConnectionConfigEnum::Mongo { .. } => "mongodb",
    ConnectionConfigEnum::Redis { .. } => "redis",
    ConnectionConfigEnum::Postgres { .. } => "postgresql",
    ConnectionConfigEnum::Sqlite { .. } => "sqlite",
    ConnectionConfigEnum::MySql { .. } => "mysql",
  }
}

#[tauri::command]
pub async fn save_connection(config: ConnectionConfig) -> Result<ConnectionId, String> {
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
pub async fn list_connections() -> Result<Vec<ConnectionSummary>, String> {
  let auth = get_auth_context();
  if !auth.can_access_connection("*") {
    return Err("Access denied".to_string());
  }
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

pub async fn check_provider_health(config: &ConnectionConfig) -> ConnectionHealth {
  match &config.config {
    ConnectionConfigEnum::Json { path, .. } => match create_json_provider(path).await {
      Ok(p) => match p.health_check().await {
        Ok(true) => ConnectionHealth::ok("json"),
        Ok(false) => ConnectionHealth::err("json: health check failed"),
        Err(e) => ConnectionHealth::err(&format!("json: health check failed: {}", e)),
      },
      Err(e) => ConnectionHealth::err(&e),
    },
    ConnectionConfigEnum::Mongo { uri, database, .. } => {
      match create_mongo_provider(uri, database).await {
        Ok(p) => {
          let healthy = match p.health_check().await {
            Ok(h) => h,
            Err(_) => matches!(p.list_collections().await, Ok(_)),
          };
          if healthy {
            ConnectionHealth::ok("mongo")
          } else {
            ConnectionHealth::err("mongo: health check failed")
          }
        }
        Err(e) => ConnectionHealth::err(&e),
      }
    }
    ConnectionConfigEnum::Redis { uri, .. } => match create_redis_provider(uri).await {
      Ok(p) => match p.health_check().await {
        Ok(true) => ConnectionHealth::ok("redis"),
        Ok(false) => ConnectionHealth::err("redis: health check failed"),
        Err(e) => ConnectionHealth::err(&format!("redis: health check failed: {}", e)),
      },
      Err(e) => ConnectionHealth::err(&e),
    },
    ConnectionConfigEnum::Postgres { uri, .. } => match create_postgres_provider(uri).await {
      Ok(p) => match p.execute_raw("SELECT 1", vec![]).await {
        Ok(_) => ConnectionHealth::ok("postgres"),
        Err(e) => ConnectionHealth::err(&format!("postgres: {}", e)),
      },
      Err(e) => ConnectionHealth::err(&format!("postgres: {}", e)),
    },
    ConnectionConfigEnum::Sqlite { path, .. } => match create_sqlite_provider(path).await {
      Ok(p) => match p.execute_raw("SELECT 1", vec![]).await {
        Ok(_) => ConnectionHealth::ok("sqlite"),
        Err(e) => ConnectionHealth::err(&format!("sqlite: {}", e)),
      },
      Err(e) => ConnectionHealth::err(&format!("sqlite: {}", e)),
    },
    ConnectionConfigEnum::MySql { uri, .. } => match create_mysql_provider(uri).await {
      Ok(p) => match p.execute_raw("SELECT 1", vec![]).await {
        Ok(_) => ConnectionHealth::ok("mysql"),
        Err(e) => ConnectionHealth::err(&format!("mysql: {}", e)),
      },
      Err(e) => ConnectionHealth::err(&format!("mysql: {}", e)),
    },
  }
}

#[tauri::command]
pub async fn test_connection_status(id: &str) -> Result<ConnectionSummary, String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(id) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(id)?;
  let store = ConnectionStore::load().await.map_err(|e| e.to_string())?;
  let entry = store
    .find_by_id(id)
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

#[tauri::command]
pub async fn delete_connection(id: &str) -> Result<(), String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(id) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(id)?;
  let mut store = ConnectionStore::load_or_default().await;
  if store.remove_connection(id) {
    store.save().await?;
  } else {
    return Err(format!("Connection {} not found", id));
  }
  if let Err(e) = delete_connection_databases_metadata(id.to_string()).await {
    eprintln!("Warning: Failed to delete connection metadata: {}", e);
  }
  Ok(())
}

#[tauri::command]
pub async fn update_connection(id: &str, config: ConnectionConfig) -> Result<(), String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(id) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(id)?;
  let mut store = ConnectionStore::load_or_default().await;
  let _entry = store
    .find_by_id(id)
    .ok_or_else(|| format!("Connection {} not found", id))?;

  let updated_entry = ConnectionEntry {
    id: id.to_string(),
    config,
  };

  store.remove_connection(id);
  store.add_connection(updated_entry);
  store.save().await?;
  Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfigResult {
  pub id: String,
  pub config: ConnectionConfig,
}

#[tauri::command]
pub async fn get_connection(id: &str) -> Result<ConnectionConfigResult, String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(id) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(id)?;
  let store = ConnectionStore::load_or_default().await;
  let entry = store
    .find_by_id(id)
    .ok_or_else(|| format!("Connection {} not found", id))?;
  Ok(ConnectionConfigResult {
    id: entry.id.clone(),
    config: entry.config.clone(),
  })
}

#[tauri::command]
pub async fn test_connection(config: ConnectionConfig) -> Result<ConnectionHealth, String> {
  Ok(check_provider_health(&config).await)
}
