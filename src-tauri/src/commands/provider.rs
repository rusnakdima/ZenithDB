use crate::commands::error_utils::ToStringError;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time;

pub struct ProviderManager {
  providers: Arc<RwLock<HashMap<String, DbProvider>>>,
}

impl ProviderManager {
  pub fn new() -> Self {
    Self {
      providers: Arc::new(RwLock::new(HashMap::new())),
    }
  }

  pub async fn release_provider(&self, id: &str) {
    let mut providers = self.providers.write().await;
    if let Some(provider) = providers.remove(id) {
      if let Err(e) = provider.close().await {
        eprintln!("Error closing provider {}: {}", id, e);
      }
    }
  }
}

impl Default for ProviderManager {
  fn default() -> Self {
    Self::new()
  }
}

pub enum DbProvider {
  Json(nosql_orm::providers::JsonProvider),
  Mongo(nosql_orm::providers::MongoProvider),
  Redis(nosql_orm::providers::RedisProvider),
  Postgres(nosql_orm::providers::sql::PostgresProvider),
  Sqlite(nosql_orm::providers::sql::SqliteProvider),
  MySql(nosql_orm::providers::sql::MySqlProvider),
}

impl DbProvider {
  pub async fn close(&mut self) -> Result<(), String> {
    match self {
      DbProvider::Json(p) => p.close().await.map_err(|e| e.to_string()),
      DbProvider::Mongo(p) => p.close().await.map_err(|e| e.to_string()),
      DbProvider::Redis(p) => p.close().await.map_err(|e| e.to_string()),
      DbProvider::Postgres(p) => p.close().await.map_err(|e| e.to_string()),
      DbProvider::Sqlite(p) => p.close().await.map_err(|e| e.to_string()),
      DbProvider::MySql(p) => p.close().await.map_err(|e| e.to_string()),
    }
  }
}

static PROVIDER_MANAGER: std::sync::OnceLock<ProviderManager> = std::sync::OnceLock::new();

pub fn get_provider_manager() -> &'static ProviderManager {
  PROVIDER_MANAGER.get_or_init(|| ProviderManager::new())
}

fn timeout_err(provider: &str, original: String) -> String {
  format!("{} connection timed out after 10s: {}", provider, original)
}

pub async fn create_json_provider(
  path: &str,
) -> Result<nosql_orm::providers::JsonProvider, String> {
  time::timeout(
    Duration::from_secs(10),
    nosql_orm::providers::JsonProvider::new(path),
  )
  .await
  .map_err(|e| timeout_err("JSON", e.to_string()))?
  .map_err(|e| format!("JSON connection error: {}", e))
}

pub async fn create_mongo_provider(
  uri: &str,
) -> Result<nosql_orm::providers::MongoProvider, String> {
  time::timeout(
    Duration::from_secs(10),
    nosql_orm::providers::MongoProvider::connect(uri, "admin"),
  )
  .await
  .map_err(|e| timeout_err("MongoDB", e.to_string()))?
  .map_err(|e| format!("MongoDB connection error: {}", e))
}

pub async fn create_redis_provider(
  uri: &str,
) -> Result<nosql_orm::providers::RedisProvider, String> {
  time::timeout(
    Duration::from_secs(10),
    nosql_orm::providers::RedisProvider::new(uri),
  )
  .await
  .map_err(|e| timeout_err("Redis", e.to_string()))?
  .map_err(|e| format!("Redis connection error: {}", e))
}

pub async fn create_postgres_provider(
  uri: &str,
) -> Result<nosql_orm::providers::sql::PostgresProvider, String> {
  time::timeout(
    Duration::from_secs(10),
    nosql_orm::providers::sql::PostgresProvider::connect(uri),
  )
  .await
  .map_err(|e| timeout_err("PostgreSQL", e.to_string()))?
  .map_err(|e| format!("PostgreSQL connection error: {}", e))
}

pub async fn create_sqlite_provider(
  path: &str,
) -> Result<nosql_orm::providers::sql::SqliteProvider, String> {
  time::timeout(
    Duration::from_secs(10),
    nosql_orm::providers::sql::SqliteProvider::connect(path),
  )
  .await
  .map_err(|e| timeout_err("SQLite", e.to_string()))?
  .map_err(|e| format!("SQLite connection error: {}", e))
}

pub async fn create_mysql_provider(
  uri: &str,
) -> Result<nosql_orm::providers::sql::MySqlProvider, String> {
  time::timeout(
    Duration::from_secs(10),
    nosql_orm::providers::sql::MySqlProvider::connect(uri),
  )
  .await
  .map_err(|e| timeout_err("MySQL", e.to_string()))?
  .map_err(|e| format!("MySQL connection error: {}", e))
}
