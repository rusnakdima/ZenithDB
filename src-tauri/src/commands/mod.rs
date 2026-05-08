use crate::commands::connection::ConnectionEntry;

pub mod admin;
pub mod connection;
pub mod data;
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
