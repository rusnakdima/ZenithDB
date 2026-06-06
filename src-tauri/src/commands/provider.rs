use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, RwLock};
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

struct ProviderInstance<T> {
  provider: T,
  created_at: Instant,
}

pub struct TypedProviderCache<T> {
  cache: RwLock<HashMap<String, ProviderInstance<T>>>,
  provider_name: &'static str,
}

impl<T: Clone> TypedProviderCache<T> {
  fn new(provider_name: &'static str) -> Self {
    Self {
      cache: RwLock::new(HashMap::new()),
      provider_name,
    }
  }

  async fn get(&self, conn_id: &str) -> Option<T> {
    let cache = self.cache.read().await;
    if let Some(instance) = cache.get(conn_id) {
      if Instant::now().duration_since(instance.created_at) < Duration::from_secs(300) {
        tracing::debug!(
          "Reusing cached {} provider for connection: {}",
          self.provider_name,
          conn_id
        );
        return Some(instance.provider.clone());
      }
    }
    None
  }

  async fn insert(&self, conn_id: String, provider: T) {
    let mut cache = self.cache.write().await;
    cache.insert(
      conn_id,
      ProviderInstance {
        provider,
        created_at: Instant::now(),
      },
    );
  }

  async fn remove(&self, conn_id: &str) {
    let mut cache = self.cache.write().await;
    cache.remove(conn_id);
  }
}

pub struct MongoProviderCache(TypedProviderCache<nosql_orm::providers::MongoProvider>);
pub struct PostgresProviderCache(TypedProviderCache<nosql_orm::providers::sql::PostgresProvider>);
pub struct MysqlProviderCache(TypedProviderCache<nosql_orm::providers::sql::MySqlProvider>);

impl MongoProviderCache {
  fn new() -> Self {
    Self(TypedProviderCache::new("MongoDB"))
  }
  async fn get(&self, conn_id: &str) -> Option<nosql_orm::providers::MongoProvider> {
    self.0.get(conn_id).await
  }
  async fn insert(&self, conn_id: String, provider: nosql_orm::providers::MongoProvider) {
    self.0.insert(conn_id, provider).await;
  }
  async fn remove(&self, conn_id: &str) {
    self.0.remove(conn_id).await;
  }
}

impl PostgresProviderCache {
  fn new() -> Self {
    Self(TypedProviderCache::new("PostgreSQL"))
  }
  async fn get(&self, conn_id: &str) -> Option<nosql_orm::providers::sql::PostgresProvider> {
    self.0.get(conn_id).await
  }
  async fn insert(&self, conn_id: String, provider: nosql_orm::providers::sql::PostgresProvider) {
    self.0.insert(conn_id, provider).await;
  }
  async fn remove(&self, conn_id: &str) {
    self.0.remove(conn_id).await;
  }
}

impl MysqlProviderCache {
  fn new() -> Self {
    Self(TypedProviderCache::new("MySQL"))
  }
  async fn get(&self, conn_id: &str) -> Option<nosql_orm::providers::sql::MySqlProvider> {
    self.0.get(conn_id).await
  }
  async fn insert(&self, conn_id: String, provider: nosql_orm::providers::sql::MySqlProvider) {
    self.0.insert(conn_id, provider).await;
  }
  async fn remove(&self, conn_id: &str) {
    self.0.remove(conn_id).await;
  }
}

static MONGO_PROVIDER_CACHE: std::sync::OnceLock<Arc<MongoProviderCache>> =
  std::sync::OnceLock::new();
static POSTGRES_PROVIDER_CACHE: std::sync::OnceLock<Arc<PostgresProviderCache>> =
  std::sync::OnceLock::new();
static MYSQL_PROVIDER_CACHE: std::sync::OnceLock<Arc<MysqlProviderCache>> =
  std::sync::OnceLock::new();

fn get_mongo_provider_cache() -> Arc<MongoProviderCache> {
  MONGO_PROVIDER_CACHE
    .get_or_init(|| Arc::new(MongoProviderCache::new()))
    .clone()
}

fn get_postgres_provider_cache() -> Arc<PostgresProviderCache> {
  POSTGRES_PROVIDER_CACHE
    .get_or_init(|| Arc::new(PostgresProviderCache::new()))
    .clone()
}

fn get_mysql_provider_cache() -> Arc<MysqlProviderCache> {
  MYSQL_PROVIDER_CACHE
    .get_or_init(|| Arc::new(MysqlProviderCache::new()))
    .clone()
}

pub async fn get_or_create_mongo_provider(
  conn_id: &str,
  uri: &str,
  database: &str,
) -> Result<nosql_orm::providers::MongoProvider, String> {
  let cache = get_mongo_provider_cache();
  if let Some(provider) = cache.get(conn_id).await {
    return Ok(provider);
  }
  let provider = create_mongo_provider(uri, database).await?;
  cache.insert(conn_id.to_string(), provider.clone()).await;
  Ok(provider)
}

pub async fn get_or_create_postgres_provider(
  conn_id: &str,
  uri: &str,
) -> Result<nosql_orm::providers::sql::PostgresProvider, String> {
  let cache = get_postgres_provider_cache();
  if let Some(provider) = cache.get(conn_id).await {
    return Ok(provider);
  }
  let provider = create_postgres_provider(uri).await?;
  cache.insert(conn_id.to_string(), provider.clone()).await;
  Ok(provider)
}

pub async fn get_or_create_mysql_provider(
  conn_id: &str,
  uri: &str,
) -> Result<nosql_orm::providers::sql::MySqlProvider, String> {
  let cache = get_mysql_provider_cache();
  if let Some(provider) = cache.get(conn_id).await {
    return Ok(provider);
  }
  let provider = create_mysql_provider(uri).await?;
  cache.insert(conn_id.to_string(), provider.clone()).await;
  Ok(provider)
}

pub async fn invalidate_provider_instance(conn_id: &str) {
  get_mongo_provider_cache().remove(conn_id).await;
  get_postgres_provider_cache().remove(conn_id).await;
  get_mysql_provider_cache().remove(conn_id).await;
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
