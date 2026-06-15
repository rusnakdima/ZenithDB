use crate::commands::connection_command::{
  ConnectionConfig, ConnectionConfigEnum, ConnectionHealth, ConnectionSummary,
};
use crate::commands::connection_entity::ConnectionEntity;
use crate::commands::provider::{
  create_mongo_provider, create_mysql_provider, create_postgres_provider, create_redis_provider,
  create_sqlite_provider,
};
use crate::commands::settings_command::delete_connection_databases_metadata;
use crate::constants::CONNECTION_TIMEOUT_SECS;
use crate::models::response::ResponseModel;
use nosql_orm::prelude::*;
use nosql_orm::providers::sql::SqliteProvider;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct ConnectionService {
  connections_db: Arc<Mutex<ConnectionsDb>>,
}

struct ConnectionsDb {
  repo: Repository<ConnectionEntity, SqliteProvider>,
  provider: SqliteProvider,
}

impl ConnectionsDb {
  async fn new() -> Result<Self, String> {
    let db_path = Self::path()?;
    if let Some(parent) = db_path.parent() {
      std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let provider = SqliteProvider::connect(db_path.to_string_lossy().as_ref())
      .await
      .map_err(|e| format!("Failed to open connections db: {}", e))?;
    let repo = Repository::new(provider.clone());
    let db = Self { repo, provider };
    db.init().await?;
    Ok(db)
  }

  fn path() -> Result<std::path::PathBuf, String> {
    let path = dirs::home_dir()
      .ok_or("Failed to get home dir")?
      .join(".zenithdb")
      .join("connections.db");
    Ok(path)
  }

  async fn init(&self) -> Result<(), String> {
    self
      .provider
      .create_collection("connections", None)
      .await
      .map_err(|e| e.to_string())?;
    log::trace!("Connections table ready");
    Ok(())
  }

  async fn save(&self, entity: &ConnectionEntity) -> Result<(), String> {
    self
      .repo
      .save(entity.clone())
      .await
      .map_err(|e| e.to_string())?;
    log::info!("Saved connection: {}", entity.get_id().unwrap_or_default());
    Ok(())
  }

  async fn find_by_id(&self, id: &str) -> Result<Option<ConnectionEntity>, String> {
    self.repo.find_by_id(id).await.map_err(|e| e.to_string())
  }

  async fn find_all(&self) -> Result<Vec<ConnectionEntity>, String> {
    self.repo.find_all().await.map_err(|e| e.to_string())
  }

  async fn delete(&self, id: &str) -> Result<(), String> {
    self.repo.delete(id).await.map_err(|e| e.to_string())?;
    log::info!("Deleted connection: {}", id);
    Ok(())
  }

  async fn exists(&self, id: &str) -> Result<bool, String> {
    self.repo.exists(id).await.map_err(|e| e.to_string())
  }
}

impl ConnectionService {
  pub async fn new() -> Result<Self, String> {
    let db = ConnectionsDb::new().await?;
    Ok(Self {
      connections_db: Arc::new(Mutex::new(db)),
    })
  }

  pub async fn get_instance() -> Arc<ConnectionService> {
    static SERVICE: tokio::sync::OnceCell<Arc<ConnectionService>> =
      tokio::sync::OnceCell::const_new();
    SERVICE
      .get_or_try_init(|| async { Self::new().await.map(Arc::new) })
      .await
      .expect("Failed to create ConnectionService")
      .clone()
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

  pub async fn check_provider_health(&self, config: &ConnectionConfig) -> ConnectionHealth {
    match &config.config {
      ConnectionConfigEnum::Json { path, .. } => self.check_json_health(path).await,
      ConnectionConfigEnum::Mongo { uri, database, .. } => {
        self.check_mongo_health(uri, database).await
      }
      ConnectionConfigEnum::Redis { uri, .. } => self.check_redis_health(uri).await,
      ConnectionConfigEnum::Postgres { uri, .. } => self.check_postgres_health(uri).await,
      ConnectionConfigEnum::Sqlite { path, .. } => self.check_sqlite_health(path).await,
      ConnectionConfigEnum::MySql { uri, .. } => self.check_mysql_health(uri).await,
    }
  }

  async fn check_json_health(&self, path: &str) -> ConnectionHealth {
    let path_obj = std::path::Path::new(path);
    if !path_obj.exists() {
      return ConnectionHealth::err("json: path does not exist");
    }
    if !path_obj.is_dir() {
      return ConnectionHealth::err("json: path is not a directory");
    }
    let path_owned = path.to_string();
    match tokio::time::timeout(std::time::Duration::from_secs(5), async {
      tokio::task::spawn_blocking(move || {
        std::fs::read_dir(&path_owned).map_err(std::io::Error::from)
      })
      .await
    })
    .await
    {
      Ok(Ok(Ok(_))) => ConnectionHealth::ok("json"),
      Ok(Ok(Err(e))) => ConnectionHealth::err(&format!("json: {}", e)),
      Ok(Err(join_err)) => ConnectionHealth::err(&format!("json: task error: {}", join_err)),
      Err(_) => ConnectionHealth::err("json: health check timed out"),
    }
  }

  async fn check_mongo_health(&self, uri: &str, database: &str) -> ConnectionHealth {
    match create_mongo_provider(uri, database).await {
      Ok(p) => {
        let healthy =
          match tokio::time::timeout(std::time::Duration::from_secs(5), p.health_check()).await {
            Ok(Ok(h)) => h,
            Ok(Err(_)) => {
              matches!(
                tokio::time::timeout(std::time::Duration::from_secs(5), p.list_collections()).await,
                Ok(Ok(_))
              )
            }
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

  async fn check_redis_health(&self, uri: &str) -> ConnectionHealth {
    match create_redis_provider(uri).await {
      Ok(p) => match p.health_check().await {
        Ok(true) => ConnectionHealth::ok("redis"),
        Ok(false) => ConnectionHealth::err("redis: health check failed"),
        Err(e) => ConnectionHealth::err(&format!("redis: health check failed: {}", e)),
      },
      Err(e) => ConnectionHealth::err(&e),
    }
  }

  async fn check_postgres_health(&self, uri: &str) -> ConnectionHealth {
    match create_postgres_provider(uri).await {
      Ok(p) => match p.execute_raw("SELECT 1", vec![]).await {
        Ok(_) => ConnectionHealth::ok("postgres"),
        Err(e) => ConnectionHealth::err(&format!("postgres: {}", e)),
      },
      Err(e) => ConnectionHealth::err(&e),
    }
  }

  async fn check_sqlite_health(&self, path: &str) -> ConnectionHealth {
    match create_sqlite_provider(path).await {
      Ok(p) => match p.execute_raw("SELECT 1", vec![]).await {
        Ok(_) => ConnectionHealth::ok("sqlite"),
        Err(e) => ConnectionHealth::err(&format!("sqlite: {}", e)),
      },
      Err(e) => ConnectionHealth::err(&e),
    }
  }

  async fn check_mysql_health(&self, uri: &str) -> ConnectionHealth {
    match create_mysql_provider(uri).await {
      Ok(p) => match p.execute_raw("SELECT 1", vec![]).await {
        Ok(_) => ConnectionHealth::ok("mysql"),
        Err(e) => ConnectionHealth::err(&format!("mysql: {}", e)),
      },
      Err(e) => ConnectionHealth::err(&e),
    }
  }

  pub async fn save_connection(
    &self,
    config: ConnectionConfig,
  ) -> Result<ResponseModel, ResponseModel> {
    let id = uuid::Uuid::new_v4().to_string();
    let type_str = Self::get_type_string(&config);

    let entity = ConnectionEntity::new(id.clone(), type_str, config.name.clone(), config);
    let db = self.connections_db.lock().await;
    db.save(&entity)
      .await
      .map_err(|e| ResponseModel::error(e))?;

    log::info!("Saved connection: {} ({})", id, entity.name);
    Ok(ResponseModel::success_message(format!(
      "Connection saved: {}",
      id
    )))
  }

  pub async fn list_connections(&self) -> Result<ResponseModel, ResponseModel> {
    let db = self.connections_db.lock().await;
    let entities = db.find_all().await.map_err(|e| ResponseModel::error(e))?;
    drop(db);

    let mut summaries = Vec::new();
    for e in entities {
      let health = self.check_provider_health(&e.config).await;
      let status = if health.healthy {
        "connected".to_string()
      } else {
        "disconnected".to_string()
      };
      summaries.push(ConnectionSummary {
        id: e.id.unwrap_or_default(),
        name: e.name,
        provider: e.type_.to_lowercase(),
        status,
      });
    }

    Ok(ResponseModel::success(summaries))
  }

  pub async fn test_connection_status(&self, id: &str) -> Result<ResponseModel, ResponseModel> {
    let db = self.connections_db.lock().await;
    let entity = db
      .find_by_id(id)
      .await
      .map_err(|e| ResponseModel::error(e))?
      .ok_or_else(|| ResponseModel::error(format!("Connection {} not found", id)))?;
    drop(db);

    let config = &entity.config;
    let health = self.check_provider_health(config).await;
    let status = if health.healthy {
      "connected".to_string()
    } else {
      "disconnected".to_string()
    };

    let summary = ConnectionSummary {
      id: entity.id.unwrap_or_default(),
      name: entity.name,
      provider: entity.type_.to_lowercase(),
      status,
    };

    Ok(ResponseModel::success(summary))
  }

  pub async fn check_health(&self, conn_id: &str) -> Result<ResponseModel, ResponseModel> {
    let db = self.connections_db.lock().await;
    let entity = db
      .find_by_id(conn_id)
      .await
      .map_err(|e| ResponseModel::error(e))?
      .ok_or_else(|| ResponseModel::error(format!("Connection {} not found", conn_id)))?;
    drop(db);

    let config = entity.config;
    let health_result = tokio::time::timeout(
      std::time::Duration::from_secs(CONNECTION_TIMEOUT_SECS),
      async { self.check_provider_health(&config).await },
    )
    .await
    .map_err(|_| ResponseModel::error("Health check timed out"))?;

    Ok(ResponseModel::success(health_result))
  }

  pub async fn delete_connection(&self, id: &str) -> Result<ResponseModel, ResponseModel> {
    let db = self.connections_db.lock().await;

    if !db.exists(id).await.map_err(|e| ResponseModel::error(e))? {
      return Err(ResponseModel::error(format!("Connection {} not found", id)));
    }

    db.delete(id).await.map_err(|e| ResponseModel::error(e))?;
    drop(db);

    if let Err(e) = delete_connection_databases_metadata(id.to_string()).await {
      log::warn!("Failed to delete connection metadata: {}", e);
    }

    log::info!("Deleted connection: {}", id);
    Ok(ResponseModel::success_message(format!(
      "Connection {} deleted",
      id
    )))
  }

  pub async fn update_connection(
    &self,
    id: &str,
    config: ConnectionConfig,
  ) -> Result<ResponseModel, ResponseModel> {
    let db = self.connections_db.lock().await;

    let existing = db
      .find_by_id(id)
      .await
      .map_err(|e| ResponseModel::error(e))?
      .ok_or_else(|| ResponseModel::error(format!("Connection {} not found", id)))?;

    let type_str = Self::get_type_string(&config);

    let entity = ConnectionEntity {
      id: Some(id.to_string()),
      type_: type_str,
      name: config.name.clone(),
      config,
      created_at: existing.created_at,
      updated_at: Some(chrono::Utc::now()),
    };

    db.save(&entity)
      .await
      .map_err(|e| ResponseModel::error(e))?;
    drop(db);
    log::info!("Updated connection: {}", id);
    Ok(ResponseModel::success_message(format!(
      "Connection {} updated",
      id
    )))
  }

  pub async fn get_connection(&self, id: &str) -> Result<ResponseModel, ResponseModel> {
    let db = self.connections_db.lock().await;
    let entity = db
      .find_by_id(id)
      .await
      .map_err(|e| ResponseModel::error(e))?
      .ok_or_else(|| ResponseModel::error(format!("Connection {} not found", id)))?;
    drop(db);

    #[derive(serde::Serialize)]
    struct ConnectionConfigResult {
      id: String,
      config: ConnectionConfig,
    }

    Ok(ResponseModel::success(ConnectionConfigResult {
      id: entity.id.unwrap_or_default(),
      config: entity.config,
    }))
  }

  pub async fn test_connection(
    &self,
    config: ConnectionConfig,
  ) -> Result<ResponseModel, ResponseModel> {
    let health = self.check_provider_health(&config).await;
    Ok(ResponseModel::success(health))
  }

  pub async fn find_entity_by_id(&self, id: &str) -> Result<Option<ConnectionEntity>, String> {
    let db = self.connections_db.lock().await;
    db.find_by_id(id).await
  }
}
