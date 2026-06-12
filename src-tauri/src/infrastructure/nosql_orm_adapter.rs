use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::types::DatabaseMeta as LocalDatabaseMeta;
use nosql_orm::prelude::*;
use nosql_orm::providers::sql::MySqlProvider;
use nosql_orm::providers::sql::PostgresProvider;
use nosql_orm::providers::sql::SqliteProvider;
use nosql_orm::providers::JsonProvider;
use nosql_orm::providers::MongoProvider;
use nosql_orm::providers::RedisProvider;
use std::path::PathBuf;
use tracing::debug;

#[allow(dead_code)]
pub enum DbProvider {
  Json(JsonProvider),
  Mongo(MongoProvider),
  Redis(RedisProvider),
  Postgres(PostgresProvider),
  Sqlite(SqliteProvider),
  MySql(MySqlProvider),
}

impl DbProvider {
  pub async fn list_databases(&self) -> Result<Vec<LocalDatabaseMeta>, String> {
    match self {
      DbProvider::Json(provider) => {
        let collections = provider.list_collections().await.map_err_string()?;
        Ok(vec![LocalDatabaseMeta {
          name: provider.get_database_name().await.map_err_string()?,
          size_bytes: None,
          table_count: Some(collections.len() as u64),
        }])
      }
      DbProvider::Mongo(provider) => {
        let db_names = provider.list_databases().await.map_err_string()?;
        Ok(
          db_names
            .into_iter()
            .map(|name| LocalDatabaseMeta {
              name,
              size_bytes: None,
              table_count: None,
            })
            .collect(),
        )
      }
      DbProvider::Postgres(provider) => {
        let db_names = provider.list_databases().await.map_err_string()?;
        Ok(
          db_names
            .into_iter()
            .map(|name| LocalDatabaseMeta {
              name,
              size_bytes: None,
              table_count: None,
            })
            .collect(),
        )
      }
      DbProvider::MySql(provider) => {
        let db_names = provider.list_databases().await.map_err_string()?;
        Ok(
          db_names
            .into_iter()
            .map(|name| LocalDatabaseMeta {
              name,
              size_bytes: None,
              table_count: None,
            })
            .collect(),
        )
      }
      DbProvider::Redis(_) => Ok(vec![LocalDatabaseMeta {
        name: "default".to_string(),
        size_bytes: None,
        table_count: None,
      }]),
      DbProvider::Sqlite(_) => Ok(vec![LocalDatabaseMeta {
        name: "default".to_string(),
        size_bytes: None,
        table_count: None,
      }]),
    }
  }
}

pub struct NosqlOrmAdapter;

pub(crate) fn validate_safe_path(base: &str, user_input: &str) -> Result<PathBuf, String> {
  debug!(base_path = %base, user_input = %user_input, "[ADAPTER] Validating path");
  let base_path = PathBuf::from(base);
  let base_canonical = base_path.canonicalize().map_err_string()?;
  let joined = base_path.join(user_input);
  let joined_canonical = joined.canonicalize().map_err_string()?;
  if joined_canonical.starts_with(&base_canonical) {
    debug!(validated_path = %joined_canonical.display(), "[ADAPTER] Path validation successful");
    Ok(joined)
  } else {
    debug!("[ADAPTER] Path traversal detected");
    Err("Path traversal detected".to_string())
  }
}

#[allow(dead_code)]
impl NosqlOrmAdapter {
  pub async fn create_provider(config: &ConnectionConfigEnum) -> Result<DbProvider, String> {
    match config {
      ConnectionConfigEnum::Json { path, .. } => {
        debug!(provider_type = "Json", path = %path, "[ADAPTER] Creating database provider");
        let provider = JsonProvider::new(path)
          .await
          .map_err(|e| format!("JSON provider error: {}", e))?;
        debug!(
          provider_type = "Json",
          "[ADAPTER] Database provider created successfully"
        );
        Ok(DbProvider::Json(provider))
      }
      ConnectionConfigEnum::Mongo { uri, database, .. } => {
        debug!(provider_type = "Mongo", uri = %uri, database = %database, "[ADAPTER] Creating database provider");
        let provider = MongoProvider::connect(uri, database)
          .await
          .map_err(|e| format!("MongoDB provider error: {}", e))?;
        debug!(
          provider_type = "Mongo",
          "[ADAPTER] Database provider created successfully"
        );
        Ok(DbProvider::Mongo(provider))
      }
      ConnectionConfigEnum::Redis { uri, .. } => {
        debug!(provider_type = "Redis", uri = %uri, "[ADAPTER] Creating database provider");
        let provider = RedisProvider::new(uri)
          .await
          .map_err(|e| format!("Redis provider error: {}", e))?;
        debug!(
          provider_type = "Redis",
          "[ADAPTER] Database provider created successfully"
        );
        Ok(DbProvider::Redis(provider))
      }
      ConnectionConfigEnum::Postgres { uri, .. } => {
        debug!(provider_type = "Postgres", uri = %uri, "[ADAPTER] Creating database provider");
        let provider = PostgresProvider::connect(uri)
          .await
          .map_err(|e| format!("PostgreSQL provider error: {}", e))?;
        debug!(
          provider_type = "Postgres",
          "[ADAPTER] Database provider created successfully"
        );
        Ok(DbProvider::Postgres(provider))
      }
      ConnectionConfigEnum::Sqlite { path, .. } => {
        debug!(provider_type = "Sqlite", path = %path, "[ADAPTER] Creating database provider");
        let provider = SqliteProvider::connect(path)
          .await
          .map_err(|e| format!("SQLite provider error: {}", e))?;
        debug!(
          provider_type = "Sqlite",
          "[ADAPTER] Database provider created successfully"
        );
        Ok(DbProvider::Sqlite(provider))
      }
      ConnectionConfigEnum::MySql { uri, .. } => {
        debug!(provider_type = "MySql", uri = %uri, "[ADAPTER] Creating database provider");
        let provider = MySqlProvider::connect(uri)
          .await
          .map_err(|e| format!("MySQL provider error: {}", e))?;
        debug!(
          provider_type = "MySql",
          "[ADAPTER] Database provider created successfully"
        );
        Ok(DbProvider::MySql(provider))
      }
    }
  }

  pub async fn create_database_json(base_path: &str, name: &str) -> Result<(), String> {
    let db_path = validate_safe_path(base_path, name)?;
    tokio::fs::create_dir_all(&db_path).await.map_err_string()?;
    Ok(())
  }

  pub async fn drop_database_json(base_path: &str, name: &str) -> Result<(), String> {
    let db_path = validate_safe_path(base_path, name)?;
    if db_path.exists() && db_path.is_dir() {
      tokio::fs::remove_dir_all(&db_path).await.map_err_string()?;
    }
    Ok(())
  }
}
