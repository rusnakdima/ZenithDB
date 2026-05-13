use crate::commands::connection_entity::ConnectionEntity;
use crate::commands::connections_db::ConnectionsDb;
use crate::commands::decentralization::delete_connection_databases_metadata;
use crate::commands::get_auth_context;
use crate::commands::provider::{
  create_json_provider, create_mongo_provider, create_mysql_provider, create_postgres_provider,
  create_redis_provider, create_sqlite_provider,
};
use crate::commands::validate_conn_id;
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};

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

fn get_type_string(config: &ConnectionConfig) -> String {
  match config.config {
    ConnectionConfigEnum::Json { .. } => "Json".to_string(),
    ConnectionConfigEnum::Mongo { .. } => "Mongo".to_string(),
    ConnectionConfigEnum::Redis { .. } => "Redis".to_string(),
    ConnectionConfigEnum::Postgres { .. } => "Postgres".to_string(),
    ConnectionConfigEnum::Sqlite { .. } => "Sqlite".to_string(),
    ConnectionConfigEnum::MySql { .. } => "MySql".to_string(),
  }
}

#[tauri::command]
pub async fn save_connection(config: ConnectionConfig) -> Result<ConnectionId, String> {
  let id = uuid::Uuid::new_v4().to_string();
  let type_str = get_type_string(&config);

  let entity = ConnectionEntity::new(id.clone(), type_str, config.name.clone(), config);
  let db = ConnectionsDb::new()?;
  db.init()?;
  db.save(&entity)?;

  tracing::info!("Saved connection: {} ({})", id, entity.name);
  Ok(id)
}

#[tauri::command]
pub async fn list_connections() -> Result<Vec<ConnectionSummary>, String> {
  let auth = get_auth_context();
  if !auth.can_access_connection("*") {
    return Err("Access denied".to_string());
  }

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

  let db = ConnectionsDb::new()?;
  db.init()?;
  let entity = db
    .find_by_id(id)?
    .ok_or_else(|| format!("Connection {} not found", id))?;

  let config = &entity.config;
  let health = check_provider_health(config).await;
  let status = if health.healthy {
    "connected".to_string()
  } else {
    "disconnected".to_string()
  };

  Ok(ConnectionSummary {
    id: entity.id,
    name: entity.name,
    provider: entity.type_.to_lowercase(),
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

  let db = ConnectionsDb::new()?;
  db.init()?;

  if !db.exists(id)? {
    return Err(format!("Connection {} not found", id));
  }

  db.delete(id)?;

  if let Err(e) = delete_connection_databases_metadata(id.to_string()).await {
    tracing::warn!("Failed to delete connection metadata: {}", e);
  }

  tracing::info!("Deleted connection: {}", id);
  Ok(())
}

#[tauri::command]
pub async fn update_connection(id: &str, config: ConnectionConfig) -> Result<(), String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(id) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(id)?;

  let db = ConnectionsDb::new()?;
  db.init()?;

  let existing = db
    .find_by_id(id)?
    .ok_or_else(|| format!("Connection {} not found", id))?;

  let type_str = get_type_string(&config);

  let entity = ConnectionEntity {
    id: id.to_string(),
    type_: type_str,
    name: config.name,
    config,
    created_at: existing.created_at,
    updated_at: chrono::Utc::now().timestamp_millis(),
  };

  db.save(&entity)?;
  tracing::info!("Updated connection: {}", id);
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

  let db = ConnectionsDb::new()?;
  db.init()?;
  let entity = db
    .find_by_id(id)?
    .ok_or_else(|| format!("Connection {} not found", id))?;

  Ok(ConnectionConfigResult {
    id: entity.id,
    config: entity.config,
  })
}

#[tauri::command]
pub async fn test_connection(config: ConnectionConfig) -> Result<ConnectionHealth, String> {
  Ok(check_provider_health(&config).await)
}
