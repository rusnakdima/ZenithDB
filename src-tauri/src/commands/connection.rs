use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionHealth {
    pub healthy: bool,
    pub server_version: Option<String>,
    pub latency_ms: Option<u64>,
}

impl ConnectionHealth {
    pub fn ok() -> Self {
        Self {
            healthy: true,
            server_version: None,
            latency_ms: None,
        }
    }
    pub fn err(msg: &str) -> Self {
        Self {
            healthy: false,
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
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read connections: {}", e))?;
        let connections: Vec<ConnectionEntry> = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse connections: {}", e))?;
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

pub fn store() -> Arc<RwLock<ConnectionStore>> {
    Arc::new(RwLock::new(ConnectionStore::load().unwrap_or_default()))
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

    let store = store();
    {
        let mut store = store.write().await;
        store.add_connection(entry);
        store.save()?;
    }
    Ok(id)
}

#[tauri::command]
pub async fn list_connections() -> Result<Vec<ConnectionSummary>, String> {
    let store = store();
    let store = store.read().await;
    let summaries = store
        .connections
        .iter()
        .map(|c| ConnectionSummary {
            id: c.id.clone(),
            name: c.config.name.clone(),
            provider: get_connection_type(&c.config).to_string(),
        })
        .collect();
    Ok(summaries)
}

#[tauri::command]
pub async fn delete_connection(id: &str) -> Result<(), String> {
    let store = store();
    {
        let mut store = store.write().await;
        if store.remove_connection(id) {
            store.save()?;
        } else {
            return Err(format!("Connection {} not found", id));
        }
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
    let store = store();
    let store = store.read().await;
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
    match &config.config {
        ConnectionConfigEnum::Json { path, .. } => {
            match nosql_orm::providers::JsonProvider::new(path).await {
                Ok(p) => {
                    let healthy = p.health_check().await.unwrap_or(false);
                    Ok(ConnectionHealth {
                        healthy,
                        server_version: Some("N/A".to_string()),
                        latency_ms: None,
                    })
                }
                Err(e) => Ok(ConnectionHealth::err(&e.to_string())),
            }
        }
        ConnectionConfigEnum::Mongo { uri, database, .. } => {
            match nosql_orm::providers::MongoProvider::connect(uri, database).await {
                Ok(_) => Ok(ConnectionHealth::ok()),
                Err(e) => Ok(ConnectionHealth::err(&e.to_string())),
            }
        }
        ConnectionConfigEnum::Redis { uri, .. } => {
            match nosql_orm::providers::RedisProvider::new(uri).await {
                Ok(p) => {
                    let healthy = p.health_check().await.unwrap_or(false);
                    Ok(ConnectionHealth {
                        healthy,
                        server_version: Some("N/A".to_string()),
                        latency_ms: None,
                    })
                }
                Err(e) => Ok(ConnectionHealth::err(&e.to_string())),
            }
        }
        ConnectionConfigEnum::Postgres { uri, .. } => {
            match nosql_orm::providers::sql::PostgresProvider::connect(uri).await {
                Ok(_) => Ok(ConnectionHealth::ok()),
                Err(e) => Ok(ConnectionHealth::err(&e.to_string())),
            }
        }
        ConnectionConfigEnum::Sqlite { path, .. } => {
            match nosql_orm::providers::sql::SqliteProvider::connect(path).await {
                Ok(_) => Ok(ConnectionHealth::ok()),
                Err(e) => Ok(ConnectionHealth::err(&e.to_string())),
            }
        }
        ConnectionConfigEnum::MySql { uri, .. } => {
            match nosql_orm::providers::sql::MySqlProvider::connect(uri).await {
                Ok(_) => Ok(ConnectionHealth::ok()),
                Err(e) => Ok(ConnectionHealth::err(&e.to_string())),
            }
        }
    }
}
