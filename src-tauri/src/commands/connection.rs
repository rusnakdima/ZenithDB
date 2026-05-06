use crate::commands::provider::{
  create_json_provider, create_mongo_provider, create_mysql_provider, create_postgres_provider,
  create_redis_provider, create_sqlite_provider,
};
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

pub type ConnectionId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
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
  connections: Vec<ConnectionEntry>,
  path: PathBuf,
}

impl ConnectionStore {
  pub fn path() -> PathBuf {
    dirs::home_dir()
      .unwrap_or_else(|| PathBuf::from("."))
      .join(".zenithdb")
      .join("connections.json")
  }

  pub fn load() -> Result<Self, String> {
    let path = Self::path();
    if !path.exists() {
      return Ok(Self::default());
    }
    let content =
      std::fs::read_to_string(&path).map_err(|e| format!("Failed to read connections: {}", e))?;
    let connections: Vec<ConnectionEntry> =
      serde_json::from_str(&content).map_err(|e| format!("Failed to parse connections: {}", e))?;
    Ok(Self { connections, path })
  }

  pub fn save(&self) -> Result<(), String> {
    if let Some(parent) = self.path.parent() {
      fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
    }
    let content = serde_json::to_string_pretty(&self.connections)
      .map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(&self.path, content)
      .map_err(|e| format!("Failed to write connections: {}", e))?;
    Ok(())
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

fn get_connection_type(config: &ConnectionConfig) -> &'static str {
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

  let mut store = ConnectionStore::load().unwrap_or_else(|e| {
    eprintln!(
      "WARNING: Failed to load connection store: {}, using empty store",
      e
    );
    ConnectionStore::default()
  });
  store.add_connection(entry);
  store.save()?;
  Ok(id)
}

#[tauri::command]
pub async fn list_connections() -> Result<Vec<ConnectionSummary>, String> {
  let store = ConnectionStore::load().unwrap_or_else(|e| {
    eprintln!(
      "WARNING: Failed to load connection store: {}, using empty store",
      e
    );
    ConnectionStore::default()
  });
  let mut summaries = Vec::new();
  for c in store.connections.iter() {
    let status = health_status_from_config(&c.config).await;
    summaries.push(ConnectionSummary {
      id: c.id.clone(),
      name: c.config.name.clone(),
      provider: get_connection_type(&c.config).to_string(),
      status,
    });
  }
  Ok(summaries)
}

async fn check_provider_health(config: &ConnectionConfig) -> ConnectionHealth {
  match &config.config {
    ConnectionConfigEnum::Json { path, .. } => match create_json_provider(path).await {
      Ok(p) => {
        let healthy = match p.health_check().await {
          Ok(h) => h,
          Err(e) => {
            eprintln!("Health check failed: {}", e);
            false
          }
        };
        if healthy {
          ConnectionHealth::ok("json")
        } else {
          ConnectionHealth::err("json: health check failed")
        }
      }
      Err(e) => ConnectionHealth::err(&e),
    },
    ConnectionConfigEnum::Mongo { uri, database, .. } => {
      match create_mongo_provider(uri, database).await {
        Ok(_) => ConnectionHealth::ok("mongo"),
        Err(e) => ConnectionHealth::err(&e),
      }
    }
    ConnectionConfigEnum::Redis { uri, .. } => match create_redis_provider(uri).await {
      Ok(p) => {
        let healthy = match p.health_check().await {
          Ok(h) => h,
          Err(e) => {
            eprintln!("Health check failed: {}", e);
            false
          }
        };
        if healthy {
          ConnectionHealth::ok("redis")
        } else {
          ConnectionHealth::err("redis: health check failed")
        }
      }
      Err(e) => ConnectionHealth::err(&e),
    },
    ConnectionConfigEnum::Postgres { uri, .. } => match create_postgres_provider(uri).await {
      Ok(_) => ConnectionHealth::ok("postgres"),
      Err(e) => ConnectionHealth::err(&e),
    },
    ConnectionConfigEnum::Sqlite { path, .. } => match create_sqlite_provider(path).await {
      Ok(_) => ConnectionHealth::ok("sqlite"),
      Err(e) => ConnectionHealth::err(&e),
    },
    ConnectionConfigEnum::MySql { uri, .. } => match create_mysql_provider(uri).await {
      Ok(_) => ConnectionHealth::ok("mysql"),
      Err(e) => ConnectionHealth::err(&e),
    },
  }
}

async fn health_status_from_config(config: &ConnectionConfig) -> String {
  let health = check_provider_health(config).await;
  if health.healthy {
    "connected".to_string()
  } else {
    "disconnected".to_string()
  }
}

#[tauri::command]
pub async fn delete_connection(id: &str) -> Result<(), String> {
  let mut store = ConnectionStore::load().unwrap_or_else(|e| {
    eprintln!(
      "WARNING: Failed to load connection store: {}, using empty store",
      e
    );
    ConnectionStore::default()
  });
  if store.remove_connection(id) {
    store.save()?;
  } else {
    return Err(format!("Connection {} not found", id));
  }
  Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfigResult {
  pub id: String,
  pub config: ConnectionConfig,
}

#[tauri::command]
pub async fn get_connection(id: &str) -> Result<ConnectionConfigResult, String> {
  let store = ConnectionStore::load().unwrap_or_else(|e| {
    eprintln!(
      "WARNING: Failed to load connection store: {}, using empty store",
      e
    );
    ConnectionStore::default()
  });
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
