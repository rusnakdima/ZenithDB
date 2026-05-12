use crate::commands::connection::ConnectionEntry;

pub mod admin;
pub mod auth;
pub mod connection;
pub mod data;
pub mod entities;
pub mod error_utils;
pub mod provider;
pub mod schema;
pub mod system;

pub async fn get_connection_entry(conn_id: &str) -> Result<ConnectionEntry, String> {
  let store = connection::ConnectionStore::load()
    .await
    .map_err(|e| e.to_string())?;
  store
    .find_by_id(conn_id)
    .cloned()
    .ok_or_else(|| format!("Connection {} not found", conn_id))
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
      ConnectionConfigEnum::Json { path, .. } => {
        let $provider = $crate::commands::provider::create_json_provider(path).await?;
        $body
      }
      ConnectionConfigEnum::Mongo { uri, database, .. } => {
        let $provider = $crate::commands::provider::create_mongo_provider(uri, database).await?;
        $body
      }
      ConnectionConfigEnum::Redis { uri, .. } => {
        let $provider = $crate::commands::provider::create_redis_provider(uri).await?;
        $body
      }
      ConnectionConfigEnum::Postgres { uri, .. } => {
        let $provider = $crate::commands::provider::create_postgres_provider(uri).await?;
        $body
      }
      ConnectionConfigEnum::Sqlite { path, .. } => {
        let $provider = $crate::commands::provider::create_sqlite_provider(path).await?;
        $body
      }
      ConnectionConfigEnum::MySql { uri, .. } => {
        let $provider = $crate::commands::provider::create_mysql_provider(uri).await?;
        $body
      }
    }
  };
}
