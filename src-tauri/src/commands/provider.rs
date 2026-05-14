use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use tokio::time;

fn timeout_err(provider: &str, original: String) -> String {
  format!("{} connection timed out after 10s: {}", provider, original)
}

struct CacheEntry {
  config_json: String,
  created_at: Instant,
}

pub struct ProviderCache {
  cache: Mutex<HashMap<String, CacheEntry>>,
}

impl ProviderCache {
  fn new() -> Self {
    Self {
      cache: Mutex::new(HashMap::new()),
    }
  }

  async fn is_cached(&self, conn_id: &str) -> bool {
    let cache = self.cache.lock().await;
    if let Some(entry) = cache.get(conn_id) {
      if Instant::now().duration_since(entry.created_at) < Duration::from_secs(300) {
        return true;
      }
    }
    false
  }

  async fn mark_cached(&self, conn_id: String, config_json: String) {
    let mut cache = self.cache.lock().await;
    cache.insert(
      conn_id,
      CacheEntry {
        config_json,
        created_at: Instant::now(),
      },
    );
  }

  async fn remove(&self, conn_id: &str) {
    let mut cache = self.cache.lock().await;
    cache.remove(conn_id);
  }

  async fn clear(&self) {
    let mut cache = self.cache.lock().await;
    cache.clear();
  }
}

static PROVIDER_CACHE: std::sync::OnceLock<Arc<ProviderCache>> = std::sync::OnceLock::new();

fn get_provider_cache() -> Arc<ProviderCache> {
  PROVIDER_CACHE
    .get_or_init(|| Arc::new(ProviderCache::new()))
    .clone()
}

pub async fn get_cached_provider(
  conn_id: &str,
  config: &crate::commands::connection::ConnectionConfigEnum,
) -> Result<(), String> {
  let cache = get_provider_cache();
  let config_json = serde_json::to_string(config).unwrap_or_default();

  if cache.is_cached(conn_id).await {
    tracing::debug!("Provider already cached for connection: {}", conn_id);
    return Ok(());
  }

  match config {
    crate::commands::connection::ConnectionConfigEnum::Json { path, .. } => {
      create_json_provider(path).await?;
    }
    crate::commands::connection::ConnectionConfigEnum::Mongo { uri, database, .. } => {
      create_mongo_provider(uri, database).await?;
    }
    crate::commands::connection::ConnectionConfigEnum::Redis { uri, .. } => {
      create_redis_provider(uri).await?;
    }
    crate::commands::connection::ConnectionConfigEnum::Postgres { uri, .. } => {
      create_postgres_provider(uri).await?;
    }
    crate::commands::connection::ConnectionConfigEnum::Sqlite { path, .. } => {
      create_sqlite_provider(path).await?;
    }
    crate::commands::connection::ConnectionConfigEnum::MySql { uri, .. } => {
      create_mysql_provider(uri).await?;
    }
  };

  cache.mark_cached(conn_id.to_string(), config_json).await;
  Ok(())
}

pub async fn invalidate_provider_cache(conn_id: &str) {
  let cache = get_provider_cache();
  cache.remove(conn_id).await;
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
  database: &str,
) -> Result<nosql_orm::providers::MongoProvider, String> {
  time::timeout(
    Duration::from_secs(10),
    nosql_orm::providers::MongoProvider::connect(uri, database),
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
