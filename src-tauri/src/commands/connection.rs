use crate::commands::connection_entity::ConnectionEntity;
use crate::commands::connections_db::get_connections_db;
use crate::commands::decentralization::delete_connection_databases_metadata;
use crate::commands::get_auth_context;
use crate::commands::provider::{
  create_mongo_provider, create_mysql_provider, create_postgres_provider, create_redis_provider,
  create_sqlite_provider,
};
use crate::commands::validate_conn_id;
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub type ConnectionId = String;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
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

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
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
  let db = get_connections_db().await?;
  let db = db.clone();
  let guard = db.lock().await;
  guard.save(&entity)?;
  drop(guard);

  tracing::info!("Saved connection: {} ({})", id, entity.name);
  Ok(id)
}

#[tauri::command]
pub async fn list_connections() -> Result<Vec<ConnectionSummary>, String> {
  let auth = get_auth_context();
  if !auth.can_access_connection("*") {
    return Err("Access denied".to_string());
  }

  let db = get_connections_db().await?;
  let db = db.clone();
  let guard = db.lock().await;
  let entities = guard.find_all()?;
  drop(guard);

  let mut summaries = Vec::new();
  for e in entities {
    let health = check_provider_health(&e.config).await;
    let status = if health.healthy {
      "connected".to_string()
    } else {
      "disconnected".to_string()
    };
    summaries.push(ConnectionSummary {
      id: e.id,
      name: e.name,
      provider: e.type_.to_lowercase(),
      status,
    });
  }

  Ok(summaries)
}

pub async fn check_provider_health(config: &ConnectionConfig) -> ConnectionHealth {
  match &config.config {
    ConnectionConfigEnum::Json { path, .. } => {
      let path_obj = std::path::Path::new(path);
      if !path_obj.exists() {
        return ConnectionHealth::err("json: path does not exist");
      }
      if !path_obj.is_dir() {
        return ConnectionHealth::err("json: path is not a directory");
      }
      match tokio::time::timeout(std::time::Duration::from_secs(5), async {
        tokio::fs::read_dir(path_obj).await
      })
      .await
      {
        Ok(Ok(_)) => ConnectionHealth::ok("json"),
        Ok(Err(e)) => ConnectionHealth::err(&format!("json: {}", e)),
        Err(_) => ConnectionHealth::err("json: health check timed out"),
      }
    }
    ConnectionConfigEnum::Mongo { uri, database, .. } => {
      match create_mongo_provider(uri, database).await {
        Ok(p) => {
          let healthy =
            match tokio::time::timeout(std::time::Duration::from_secs(5), p.health_check()).await {
              Ok(Ok(h)) => h,
              Ok(Err(_)) => matches!(
                tokio::time::timeout(std::time::Duration::from_secs(5), p.list_collections()).await,
                Ok(Ok(_))
              ),
              Err(_) => false,
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

  let db = get_connections_db().await?;
  let db = db.clone();
  let guard = db.lock().await;
  let entity = guard
    .find_by_id(id)?
    .ok_or_else(|| format!("Connection {} not found", id))?;
  drop(guard);

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
pub async fn check_health(connId: &str) -> Result<ConnectionHealth, String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(connId) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(connId)?;

  let db = get_connections_db().await?;
  let db = db.clone();
  let guard = db.lock().await;
  let entity = guard
    .find_by_id(connId)?
    .ok_or_else(|| format!("Connection {} not found", connId))?;
  drop(guard);

  tokio::time::timeout(std::time::Duration::from_secs(10), async {
    Ok(check_provider_health(&entity.config).await)
  })
  .await
  .map_err(|_| "Health check timed out".to_string())?
}

#[tauri::command]
pub async fn delete_connection(id: &str) -> Result<(), String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(id) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(id)?;

  let db = get_connections_db().await?;
  let db = db.clone();
  let guard = db.lock().await;

  if !guard.exists(id)? {
    return Err(format!("Connection {} not found", id));
  }

  guard.delete(id)?;
  drop(guard);

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

  let db = get_connections_db().await?;
  let db = db.clone();
  let guard = db.lock().await;

  let existing = guard
    .find_by_id(id)?
    .ok_or_else(|| format!("Connection {} not found", id))?;

  let type_str = get_type_string(&config);

  let entity = ConnectionEntity {
    id: id.to_string(),
    type_: type_str,
    name: config.name.clone(),
    config,
    created_at: existing.created_at,
    updated_at: chrono::Utc::now().timestamp_millis(),
  };

  guard.save(&entity)?;
  drop(guard);
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

  let db = get_connections_db().await?;
  let db = db.clone();
  let guard = db.lock().await;
  let entity = guard
    .find_by_id(id)?
    .ok_or_else(|| format!("Connection {} not found", id))?;
  drop(guard);

  Ok(ConnectionConfigResult {
    id: entity.id,
    config: entity.config,
  })
}

#[tauri::command]
pub async fn test_connection(config: ConnectionConfig) -> Result<ConnectionHealth, String> {
  Ok(check_provider_health(&config).await)
}
