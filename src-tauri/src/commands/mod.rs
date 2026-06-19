use crate::models::response::ResponseModel;
use crate::services::connection_service::ConnectionService;
use crate::utils::logger::DataflowTimer;

#[path = "connection.command.rs"]
pub mod connection_command;
#[path = "connection-entity.command.rs"]
pub mod connection_entity;
#[path = "database.command.rs"]
pub mod database_command;
#[path = "error-utils.command.rs"]
pub mod error_utils;
#[path = "ipc_commands.rs"]
pub mod ipc_commands;
#[path = "logger.command.rs"]
pub mod logger;
#[path = "provider.command.rs"]
pub mod provider;
#[path = "query.command.rs"]
pub mod query_command;
#[path = "schema.command.rs"]
pub mod schema_command;
#[path = "screenshot.command.rs"]
pub mod screenshot_command;
#[path = "settings.command.rs"]
pub mod settings_command;
#[path = "types.command.rs"]
pub mod types;

pub use connection_command::ConnectionConfig;

#[derive(Debug, Clone)]
pub struct ConnectionEntry {
  pub config: ConnectionConfig,
}

pub async fn get_connection_entry(conn_id: &str) -> Result<ConnectionEntry, String> {
  let service = ConnectionService::get_instance().await;
  let entity = service
    .find_entity_by_id(conn_id)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Connection {} not found", conn_id))?;
  let config: ConnectionConfig =
    serde_json::from_str(&entity.config).map_err(|e| format!("Failed to parse config: {}", e))?;
  Ok(ConnectionEntry { config })
}

pub async fn get_connection_entry_with_timer(
  conn_id: &str,
  timer: &DataflowTimer,
) -> Result<ConnectionEntry, ResponseModel> {
  get_connection_entry(conn_id).await.map_err(|e| {
    timer.clone().finish_error(&e);
    ResponseModel::error(e)
  })
}

pub fn validate_conn_id(id: &str) -> Result<(), String> {
  uuid::Uuid::parse_str(id)
    .map(|_| ())
    .map_err(|e| format!("Invalid connection ID: {}", e))
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

#[macro_export]
macro_rules! dispatch_provider {
  ($entry:expr, $provider:ident => $body:block) => {
    match &$entry.config.config {
      $crate::commands::connection_command::ConnectionConfigEnum::Json { path, .. } => {
        let $provider = $crate::commands::provider::create_json_provider(&path).await?;
        $body
      }
      $crate::commands::connection_command::ConnectionConfigEnum::Mongo {
        uri, database, ..
      } => {
        let $provider = $crate::commands::provider::create_mongo_provider(&uri, &database).await?;
        $body
      }
      $crate::commands::connection_command::ConnectionConfigEnum::Redis { uri, .. } => {
        let $provider = $crate::commands::provider::create_redis_provider(&uri).await?;
        $body
      }
      $crate::commands::connection_command::ConnectionConfigEnum::Postgres { uri, .. } => {
        let $provider = $crate::commands::provider::create_postgres_provider(&uri).await?;
        $body
      }
      $crate::commands::connection_command::ConnectionConfigEnum::Sqlite { path, .. } => {
        let $provider = $crate::commands::provider::create_sqlite_provider(&path).await?;
        $body
      }
      $crate::commands::connection_command::ConnectionConfigEnum::MySql { uri, .. } => {
        let $provider = $crate::commands::provider::create_mysql_provider(&uri).await?;
        $body
      }
    }
  };
}
