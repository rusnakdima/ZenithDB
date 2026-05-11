use crate::commands::provider::{
  create_json_provider, create_mongo_provider, create_mysql_provider, create_postgres_provider,
  create_redis_provider, create_sqlite_provider,
};
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::fs;
use tokio::sync::{Mutex, RwLock};
use tokio::time;

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
      Err(e) => {
        tracing::warn!("Failed to load connection store: {}, using empty store", e);
        Self::default()
      }
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

struct CachedConnectionStore {
  store: Arc<Mutex<ConnectionStore>>,
  loaded_at: Instant,
  file_mtime: u64,
}

impl CachedConnectionStore {
  fn new(store: Arc<Mutex<ConnectionStore>>, file_mtime: u64) -> Self {
    Self {
      store,
      loaded_at: Instant::now(),
      file_mtime,
    }
  }

  fn is_valid(&self) -> bool {
    if self.loaded_at.elapsed().as_secs() >= 30 {
      return false;
    }
    if let Ok(metadata) = std::fs::metadata(self.store.lock().await.path.clone()) {
      if let Ok(modified) = metadata.modified() {
        if let Ok(mtime) = modified.duration_since(UNIX_EPOCH) {
          return mtime.as_secs() == self.file_mtime;
        }
      }
    }
    true
  }
}

static CONNECTION_CACHE: std::sync::OnceLock<Arc<RwLock<Option<CachedConnectionStore>>>> =
  std::sync::OnceLock::new();

fn get_connection_cache() -> &'static Arc<RwLock<Option<CachedConnectionStore>>> {
  CONNECTION_CACHE.get_or_init(Arc::new(RwLock::new(None)))
}

pub async fn load_or_default_cached() -> Arc<Mutex<ConnectionStore>> {
  let cache = get_connection_cache();
  let cached = cache.read().await;
  if let Some(ref cached) = *cached {
    if cached.is_valid() {
      return cached.store.clone();
    }
  }
  drop(cached);

  let store = Arc::new(Mutex::new(ConnectionStore::load_or_default().await));
  let file_mtime = get_file_mtime(&store.lock().await.path).await.unwrap_or(0);
  let mut cache = cache.write().await;
  *cache = Some(CachedConnectionStore::new(store.clone(), file_mtime));
  store
}

async fn get_file_mtime(path: &Path) -> Option<u64> {
  std::fs::metadata(path)
    .ok()
    .and_then(|m| m.modified().ok())
    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
    .map(|d| d.as_secs())
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

  let store = load_or_default_cached().await;
  let mut store = store.lock().await;
  store.add_connection(entry);
  store.save().await?;
  Ok(id)
}

#[tauri::command]
pub async fn list_connections() -> Result<Vec<ConnectionSummary>, String> {
  let store = load_or_default_cached().await;
  let store = store.lock().await;
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

async fn check_provider_health(config: &ConnectionConfig) -> ConnectionHealth {
  match &config.config {
    ConnectionConfigEnum::Json { path, .. } => match create_json_provider(path).await {
      Ok(p) => {
        let healthy = match time::timeout(Duration::from_secs(5), p.health_check()).await {
          Ok(Ok(h)) => h,
          Ok(Err(e)) => {
            return ConnectionHealth::err(&format!("json: health check failed: {}", e));
          }
          Err(_) => {
            return ConnectionHealth::err("json: health check timed out after 5s");
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
    ConnectionConfigEnum::Mongo { uri, .. } => match create_mongo_provider(uri).await {
      Ok(p) => {
        let health_check_fut = p.health_check();
        let list_collections_fut = p.list_collections();

        let healthy = match time::timeout(Duration::from_secs(5), health_check_fut).await {
          Ok(Ok(h)) => Some(h),
          Ok(Err(_)) => None,
          Err(_) => None,
        };

        let healthy = match healthy {
          Some(h) => h,
          None => match time::timeout(Duration::from_secs(5), list_collections_fut).await {
            Ok(Ok(_)) => true,
            Ok(Err(e)) => {
              return ConnectionHealth::err(&format!("mongo: health check failed: {}", e));
            }
            Err(_) => {
              return ConnectionHealth::err("mongo: health check timed out after 5s");
            }
          },
        };

        if healthy {
          ConnectionHealth::ok("mongo")
        } else {
          ConnectionHealth::err("mongo: health check failed")
        }
      }
      Err(e) => ConnectionHealth::err(&e),
    },
    ConnectionConfigEnum::Redis { uri, .. } => match create_redis_provider(uri).await {
      Ok(p) => {
        let healthy = match time::timeout(Duration::from_secs(5), p.health_check()).await {
          Ok(Ok(h)) => h,
          Ok(Err(e)) => {
            return ConnectionHealth::err(&format!("redis: health check failed: {}", e));
          }
          Err(_) => {
            return ConnectionHealth::err("redis: health check timed out after 5s");
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
      Ok(p) => match time::timeout(Duration::from_secs(5), p.execute_raw("SELECT 1", vec![])).await
      {
        Ok(Ok(_)) => ConnectionHealth::ok("postgres"),
        Ok(Err(e)) => ConnectionHealth::err(&format!("postgres: {}", e)),
        Err(_) => ConnectionHealth::err("postgres: health check timed out after 5s"),
      },
      Err(e) => ConnectionHealth::err(&e),
    },
    ConnectionConfigEnum::Sqlite { path, .. } => match create_sqlite_provider(path).await {
      Ok(p) => match time::timeout(Duration::from_secs(5), p.execute_raw("SELECT 1", vec![])).await
      {
        Ok(Ok(_)) => ConnectionHealth::ok("sqlite"),
        Ok(Err(e)) => ConnectionHealth::err(&format!("sqlite: {}", e)),
        Err(_) => ConnectionHealth::err("sqlite: health check timed out after 5s"),
      },
      Err(e) => ConnectionHealth::err(&e),
    },
    ConnectionConfigEnum::MySql { uri, .. } => match create_mysql_provider(uri).await {
      Ok(p) => match time::timeout(Duration::from_secs(5), p.execute_raw("SELECT 1", vec![])).await
      {
        Ok(Ok(_)) => ConnectionHealth::ok("mysql"),
        Ok(Err(e)) => ConnectionHealth::err(&format!("mysql: {}", e)),
        Err(_) => ConnectionHealth::err("mysql: health check timed out after 5s"),
      },
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
pub async fn test_connection_status(id: &str) -> Result<ConnectionSummary, String> {
  let store = load_or_default_cached().await;
  let store = store.lock().await;
  let entry = store
    .find_by_id(id)
    .ok_or_else(|| format!("Connection {} not found", id))?;

  let status = health_status_from_config(&entry.config).await;

  Ok(ConnectionSummary {
    id: entry.id.clone(),
    name: entry.config.name.clone(),
    provider: get_connection_type(&entry.config).to_string(),
    status,
  })
}

#[tauri::command]
pub async fn delete_connection(id: &str) -> Result<(), String> {
  let store = load_or_default_cached().await;
  let mut store = store.lock().await;
  if store.remove_connection(id) {
    store.save().await?;
  } else {
    return Err(format!("Connection {} not found", id));
  }
  Ok(())
}

#[tauri::command]
pub async fn update_connection(id: &str, config: ConnectionConfig) -> Result<(), String> {
  let store = load_or_default_cached().await;
  let mut store = store.lock().await;
  let _entry = store
    .find_by_id(id)
    .ok_or_else(|| format!("Connection {} not found", id))?;

  let updated_entry = ConnectionEntry {
    id: id.to_string(),
    config,
  };

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
  let store = load_or_default_cached().await;
  let store = store.lock().await;
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
