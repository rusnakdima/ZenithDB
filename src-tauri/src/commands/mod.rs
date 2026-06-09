use crate::commands::connection_entity::ConnectionEntity;
use crate::commands::connections_db::get_connections_db;

pub mod admin;
pub mod auth;
pub mod connection;
pub mod connection_entity;
pub mod connections_db;
pub mod data;
pub mod decentralization;
pub mod entities;
pub mod error_utils;
pub mod provider;
pub mod schema;
pub mod system;
pub mod types;

#[derive(Debug, Clone)]
pub struct ConnectionEntry {
  pub id: String,
  pub config: crate::commands::connection::ConnectionConfig,
}

pub async fn get_connection_entry(conn_id: &str) -> Result<ConnectionEntry, String> {
  let db = get_connections_db().await?;
  let db = db.clone();
  let guard = db.lock().await;
  let result: Option<ConnectionEntity> = guard.find_by_id(conn_id).map_err(|e| e.to_string())?;
  drop(guard);
  let entity = result.ok_or_else(|| format!("Connection {} not found", conn_id))?;
  Ok(ConnectionEntry {
    id: entity.id,
    config: entity.config,
  })
}

pub fn validate_conn_id(id: &str) -> Result<(), String> {
  if id.len() != 36 {
    return Err("Connection ID must be 36 characters".to_string());
  }
  let parts: Vec<&str> = id.split('-').collect();
  if parts.len() != 5 {
    return Err("Invalid UUID format".to_string());
  }
  if parts[0].len() != 8
    || parts[1].len() != 4
    || parts[2].len() != 4
    || parts[3].len() != 4
    || parts[4].len() != 12
  {
    return Err("Invalid UUID segment lengths".to_string());
  }
  if !parts
    .iter()
    .all(|p| p.chars().all(|c| c.is_ascii_hexdigit()))
  {
    return Err("Connection ID contains invalid characters".to_string());
  }
  Ok(())
}

pub fn validate_name(name: &str) -> Result<(), String> {
  if name.is_empty() {
    return Err("Name cannot be empty".to_string());
  }
  if name.len() > 255 {
    return Err("Name must be 255 characters or less".to_string());
  }
  if name.contains(['/', '\\', '\0', ';', '\'', '"', '`', '(', ')', ',']) {
    return Err("Name contains invalid characters".to_string());
  }
  let lower = name.to_lowercase();
  if lower.contains("drop ")
    || lower.contains("delete ")
    || lower.contains("insert ")
    || lower.contains("update ")
    || lower.contains("select ")
    || lower.contains("--")
    || lower.contains("/*")
  {
    return Err("Name contains invalid patterns".to_string());
  }
  Ok(())
}

pub fn get_auth_context() -> crate::commands::auth::AuthContext {
  crate::commands::auth::AuthContext::new()
}

#[macro_export]
macro_rules! dispatch_provider {
  ($entry:expr, $provider:ident => $body:block) => {
    match &$entry.config.config {
      crate::commands::connection::ConnectionConfigEnum::Json { path, .. } => {
        let $provider = $crate::commands::provider::create_json_provider(path).await?;
        $body
      }
      crate::commands::connection::ConnectionConfigEnum::Mongo { uri, database, .. } => {
        let $provider = $crate::commands::provider::create_mongo_provider(uri, database).await?;
        $body
      }
      crate::commands::connection::ConnectionConfigEnum::Redis { uri, .. } => {
        let $provider = $crate::commands::provider::create_redis_provider(uri).await?;
        $body
      }
      crate::commands::connection::ConnectionConfigEnum::Postgres { uri, .. } => {
        let $provider = $crate::commands::provider::create_postgres_provider(uri).await?;
        $body
      }
      crate::commands::connection::ConnectionConfigEnum::Sqlite { path, .. } => {
        let $provider = $crate::commands::provider::create_sqlite_provider(path).await?;
        $body
      }
      crate::commands::connection::ConnectionConfigEnum::MySql { uri, .. } => {
        let $provider = $crate::commands::provider::create_mysql_provider(uri).await?;
        $body
      }
    }
  };
}

#[macro_export]
macro_rules! dispatch_provider_cached {
  ($entry:expr, $conn_id:expr, $provider:ident => $body:block) => {
    match &$entry.config.config {
      crate::commands::connection::ConnectionConfigEnum::Json { path, .. } => {
        let $provider = $crate::commands::provider::create_json_provider(path).await?;
        $body
      }
      crate::commands::connection::ConnectionConfigEnum::Mongo { uri, database, .. } => {
        let $provider =
          $crate::commands::provider::get_or_create_mongo_provider($conn_id, uri, database).await?;
        $body
      }
      crate::commands::connection::ConnectionConfigEnum::Redis { uri, .. } => {
        let $provider = $crate::commands::provider::create_redis_provider(uri).await?;
        $body
      }
      crate::commands::connection::ConnectionConfigEnum::Postgres { uri, .. } => {
        let $provider =
          $crate::commands::provider::get_or_create_postgres_provider($conn_id, uri).await?;
        $body
      }
      crate::commands::connection::ConnectionConfigEnum::Sqlite { path, .. } => {
        let $provider = $crate::commands::provider::create_sqlite_provider(path).await?;
        $body
      }
      crate::commands::connection::ConnectionConfigEnum::MySql { uri, .. } => {
        let $provider =
          $crate::commands::provider::get_or_create_mysql_provider($conn_id, uri).await?;
        $body
      }
    }
  };
}
