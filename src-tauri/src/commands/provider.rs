use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tokio::time;

use crate::constants::{CACHE_TTL_SECONDS, CONNECTION_TIMEOUT_SECS};

fn timeout_err(provider: &str, original: String) -> String {
  format!(
    "{} connection timed out after {}s: {}",
    provider, CONNECTION_TIMEOUT_SECS, original
  )
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
      if Instant::now().duration_since(instance.created_at) < Duration::from_secs(CACHE_TTL_SECONDS)
      {
        log::debug!(
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
}

pub type MongoProviderCache = TypedProviderCache<nosql_orm::providers::MongoProvider>;
pub type PostgresProviderCache = TypedProviderCache<nosql_orm::providers::sql::PostgresProvider>;
pub type MysqlProviderCache = TypedProviderCache<nosql_orm::providers::sql::MySqlProvider>;

static MONGO_PROVIDER_CACHE: std::sync::OnceLock<Arc<MongoProviderCache>> =
  std::sync::OnceLock::new();
static POSTGRES_PROVIDER_CACHE: std::sync::OnceLock<Arc<PostgresProviderCache>> =
  std::sync::OnceLock::new();
static MYSQL_PROVIDER_CACHE: std::sync::OnceLock<Arc<MysqlProviderCache>> =
  std::sync::OnceLock::new();

macro_rules! define_provider_cache_getter {
  ($fn_name:ident, $static_var:ident, $cache_type:ty, $name:literal) => {
    fn $fn_name() -> Arc<$cache_type> {
      $static_var
        .get_or_init(|| Arc::new(TypedProviderCache::new($name)))
        .clone()
    }
  };
}

define_provider_cache_getter!(
  get_mongo_provider_cache,
  MONGO_PROVIDER_CACHE,
  MongoProviderCache,
  "MongoDB"
);
define_provider_cache_getter!(
  get_postgres_provider_cache,
  POSTGRES_PROVIDER_CACHE,
  PostgresProviderCache,
  "PostgreSQL"
);
define_provider_cache_getter!(
  get_mysql_provider_cache,
  MYSQL_PROVIDER_CACHE,
  MysqlProviderCache,
  "MySQL"
);

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

pub async fn create_json_provider(
  path: &str,
) -> Result<nosql_orm::providers::JsonProvider, String> {
  time::timeout(
    Duration::from_secs(CONNECTION_TIMEOUT_SECS),
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
    Duration::from_secs(CONNECTION_TIMEOUT_SECS),
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
    Duration::from_secs(CONNECTION_TIMEOUT_SECS),
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
    Duration::from_secs(CONNECTION_TIMEOUT_SECS),
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
    Duration::from_secs(CONNECTION_TIMEOUT_SECS),
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
    Duration::from_secs(CONNECTION_TIMEOUT_SECS),
    nosql_orm::providers::sql::MySqlProvider::connect(uri),
  )
  .await
  .map_err(|e| timeout_err("MySQL", e.to_string()))?
  .map_err(|e| format!("MySQL connection error: {}", e))
}
