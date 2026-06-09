use crate::commands::connection::{
  ConnectionConfig, ConnectionConfigEnum, ConnectionHealth, ConnectionSummary,
};
use crate::commands::connection_entity::ConnectionEntity;
use crate::commands::decentralization::delete_connection_databases_metadata;
use crate::commands::provider::{
  create_mongo_provider, create_mysql_provider, create_postgres_provider, create_redis_provider,
  create_sqlite_provider,
};
use crate::models::response::ResponseModel;
use nosql_orm::provider::{AdminCommands, DatabaseProvider, SchemaIntrospection};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct ConnectionService {
  connections_db: Arc<Mutex<ConnectionsDb>>,
}

struct ConnectionsDb {
  conn: rusqlite::Connection,
}

impl ConnectionsDb {
  fn new() -> Result<Self, String> {
    let db_path = Self::path()?;
    if let Some(parent) = db_path.parent() {
      std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = rusqlite::Connection::open(&db_path)
      .map_err(|e| format!("Failed to open connections db: {}", e))?;
    let db = Self { conn };
    db.init()?;
    Ok(db)
  }

  fn path() -> Result<std::path::PathBuf, String> {
    let path = dirs::home_dir()
      .ok_or("Failed to get home dir")?
      .join(".zenithdb")
      .join("connections.db");
    Ok(path)
  }

  fn init(&self) -> Result<(), String> {
    self
      .conn
      .execute(
        "CREATE TABLE IF NOT EXISTS connections (
                id TEXT PRIMARY KEY,
                type_ TEXT NOT NULL,
                name TEXT NOT NULL,
                config TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
        [],
      )
      .map_err(|e| e.to_string())?;
    tracing::trace!("Connections table ready");
    Ok(())
  }

  fn save(&self, entity: &ConnectionEntity) -> Result<(), String> {
    let config_json = serde_json::to_string(&entity.config).map_err(|e| e.to_string())?;

    self
      .conn
      .execute(
        "INSERT OR REPLACE INTO connections (id, type_, name, config, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
          entity.id,
          entity.type_,
          entity.name,
          config_json,
          entity.created_at,
          entity.updated_at
        ],
      )
      .map_err(|e| e.to_string())?;
    tracing::info!("Saved connection: {}", entity.id);
    Ok(())
  }

  fn find_by_id(&self, id: &str) -> Result<Option<ConnectionEntity>, String> {
    let mut stmt = self
      .conn
      .prepare(
        "SELECT id, type_, name, config, created_at, updated_at FROM connections WHERE id = ?1",
      )
      .map_err(|e| e.to_string())?;

    let result = stmt.query_row(rusqlite::params![id], |row| {
      let config_json: String = row.get(3)?;
      let config: ConnectionConfig = serde_json::from_str(&config_json).map_err(|e| {
        rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
          std::io::ErrorKind::InvalidData,
          e,
        )))
      })?;

      Ok(ConnectionEntity {
        id: row.get(0)?,
        type_: row.get(1)?,
        name: row.get(2)?,
        config,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
      })
    });

    match result {
      Ok(entity) => Ok(Some(entity)),
      Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
      Err(e) => Err(e.to_string()),
    }
  }

  fn find_all(&self) -> Result<Vec<ConnectionEntity>, String> {
    let mut stmt = self
      .conn
      .prepare("SELECT id, type_, name, config, created_at, updated_at FROM connections")
      .map_err(|e| e.to_string())?;

    let entities = stmt
      .query_map([], |row| {
        let config_json: String = row.get(3)?;
        let config: ConnectionConfig = serde_json::from_str(&config_json).map_err(|e| {
          rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            e,
          )))
        })?;

        Ok(ConnectionEntity {
          id: row.get(0)?,
          type_: row.get(1)?,
          name: row.get(2)?,
          config,
          created_at: row.get(4)?,
          updated_at: row.get(5)?,
        })
      })
      .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for entity in entities {
      match entity {
        Ok(e) => result.push(e),
        Err(e) => return Err(e.to_string()),
      }
    }
    Ok(result)
  }

  fn delete(&self, id: &str) -> Result<(), String> {
    self
      .conn
      .execute(
        "DELETE FROM connections WHERE id = ?1",
        rusqlite::params![id],
      )
      .map_err(|e| e.to_string())?;
    tracing::info!("Deleted connection: {}", id);
    Ok(())
  }

  fn exists(&self, id: &str) -> Result<bool, String> {
    let mut stmt = self
      .conn
      .prepare("SELECT 1 FROM connections WHERE id = ?1")
      .map_err(|e| e.to_string())?;
    let exists = stmt
      .exists(rusqlite::params![id])
      .map_err(|e| e.to_string())?;
    Ok(exists)
  }
}

impl ConnectionService {
  pub fn new() -> Result<Self, String> {
    let db = ConnectionsDb::new()?;
    Ok(Self {
      connections_db: Arc::new(Mutex::new(db)),
    })
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

  pub fn get_connection_type(config: &ConnectionConfig) -> &'static str {
    match config.config {
      ConnectionConfigEnum::Json { .. } => "json",
      ConnectionConfigEnum::Mongo { .. } => "mongodb",
      ConnectionConfigEnum::Redis { .. } => "redis",
      ConnectionConfigEnum::Postgres { .. } => "postgresql",
      ConnectionConfigEnum::Sqlite { .. } => "sqlite",
      ConnectionConfigEnum::MySql { .. } => "mysql",
    }
  }

  pub async fn check_provider_health(config: &ConnectionConfig) -> ConnectionHealth {
    match &config.config {
      ConnectionConfigEnum::Json { path, .. } => {
        let path_obj = std::path::Path::new(path);
        if !path_obj.exists() {
          return ConnectionHealth::err("json: path does not exist");
        }
        if !path_obj.is_dir() {
          return ConnectionHealth::err("json: path is not a directory");
        }
        match tokio::time::timeout(std::time::Duration::from_secs(5), async {
          tokio::fs::read_dir(path_obj).await
        })
        .await
        {
          Ok(Ok(_)) => ConnectionHealth::ok("json"),
          Ok(Err(e)) => ConnectionHealth::err(&format!("json: {}", e)),
          Err(_) => ConnectionHealth::err("json: health check timed out"),
        }
      }
      ConnectionConfigEnum::Mongo { uri, database, .. } => {
        match create_mongo_provider(uri, database).await {
          Ok(p) => {
            let healthy =
              match tokio::time::timeout(std::time::Duration::from_secs(5), p.health_check()).await
              {
                Ok(Ok(h)) => h,
                Ok(Err(_)) => matches!(
                  tokio::time::timeout(std::time::Duration::from_secs(5), p.list_collections())
                    .await,
                  Ok(Ok(_))
                ),
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
      ConnectionConfigEnum::Redis { uri, .. } => match create_redis_provider(uri).await {
        Ok(p) => match p.health_check().await {
          Ok(true) => ConnectionHealth::ok("redis"),
          Ok(false) => ConnectionHealth::err("redis: health check failed"),
          Err(e) => ConnectionHealth::err(&format!("redis: health check failed: {}", e)),
        },
        Err(e) => ConnectionHealth::err(&e),
      },
      ConnectionConfigEnum::Postgres { uri, .. } => match create_postgres_provider(uri).await {
        Ok(p) => match p.execute_raw("SELECT 1", vec![]).await {
          Ok(_) => ConnectionHealth::ok("postgres"),
          Err(e) => ConnectionHealth::err(&format!("postgres: {}", e)),
        },
        Err(e) => ConnectionHealth::err(&format!("postgres: {}", e)),
      },
      ConnectionConfigEnum::Sqlite { path, .. } => match create_sqlite_provider(path).await {
        Ok(p) => match p.execute_raw("SELECT 1", vec![]).await {
          Ok(_) => ConnectionHealth::ok("sqlite"),
          Err(e) => ConnectionHealth::err(&format!("sqlite: {}", e)),
        },
        Err(e) => ConnectionHealth::err(&format!("sqlite: {}", e)),
      },
      ConnectionConfigEnum::MySql { uri, .. } => match create_mysql_provider(uri).await {
        Ok(p) => match p.execute_raw("SELECT 1", vec![]).await {
          Ok(_) => ConnectionHealth::ok("mysql"),
          Err(e) => ConnectionHealth::err(&format!("mysql: {}", e)),
        },
        Err(e) => ConnectionHealth::err(&format!("mysql: {}", e)),
      },
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
    db.save(&entity).map_err(|e| ResponseModel::error(e))?;

    tracing::info!("Saved connection: {} ({})", id, entity.name);
    Ok(ResponseModel::success_message(format!(
      "Connection saved: {}",
      id
    )))
  }

  pub async fn list_connections(&self) -> Result<ResponseModel, ResponseModel> {
    let db = self.connections_db.lock().await;
    let entities = db.find_all().map_err(|e| ResponseModel::error(e))?;
    drop(db);

    let mut summaries = Vec::new();
    for e in entities {
      let health = Self::check_provider_health(&e.config).await;
      let status = if health.healthy {
        "connected".to_string()
      } else {
        "disconnected".to_string()
      };
      summaries.push(ConnectionSummary {
        id: e.id,
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
      .map_err(|e| ResponseModel::error(e))?
      .ok_or_else(|| ResponseModel::error(format!("Connection {} not found", id)))?;
    drop(db);

    let config = &entity.config;
    let health = Self::check_provider_health(config).await;
    let status = if health.healthy {
      "connected".to_string()
    } else {
      "disconnected".to_string()
    };

    let summary = ConnectionSummary {
      id: entity.id,
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
      .map_err(|e| ResponseModel::error(e))?
      .ok_or_else(|| ResponseModel::error(format!("Connection {} not found", conn_id)))?;
    drop(db);

    let config = entity.config;
    let health_result = tokio::time::timeout(std::time::Duration::from_secs(10), async {
      Self::check_provider_health(&config).await
    })
    .await
    .map_err(|_| ResponseModel::error("Health check timed out"))?;

    Ok(ResponseModel::success(health_result))
  }

  pub async fn delete_connection(&self, id: &str) -> Result<ResponseModel, ResponseModel> {
    let db = self.connections_db.lock().await;

    if !db.exists(id).map_err(|e| ResponseModel::error(e))? {
      return Err(ResponseModel::error(format!("Connection {} not found", id)));
    }

    db.delete(id).map_err(|e| ResponseModel::error(e))?;
    drop(db);

    if let Err(e) = delete_connection_databases_metadata(id.to_string()).await {
      tracing::warn!("Failed to delete connection metadata: {}", e);
    }

    tracing::info!("Deleted connection: {}", id);
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
      .map_err(|e| ResponseModel::error(e))?
      .ok_or_else(|| ResponseModel::error(format!("Connection {} not found", id)))?;

    let type_str = Self::get_type_string(&config);

    let entity = ConnectionEntity {
      id: id.to_string(),
      type_: type_str,
      name: config.name.clone(),
      config,
      created_at: existing.created_at,
      updated_at: chrono::Utc::now().timestamp_millis(),
    };

    db.save(&entity).map_err(|e| ResponseModel::error(e))?;
    drop(db);
    tracing::info!("Updated connection: {}", id);
    Ok(ResponseModel::success_message(format!(
      "Connection {} updated",
      id
    )))
  }

  pub async fn get_connection(&self, id: &str) -> Result<ResponseModel, ResponseModel> {
    let db = self.connections_db.lock().await;
    let entity = db
      .find_by_id(id)
      .map_err(|e| ResponseModel::error(e))?
      .ok_or_else(|| ResponseModel::error(format!("Connection {} not found", id)))?;
    drop(db);

    #[derive(serde::Serialize)]
    struct ConnectionConfigResult {
      id: String,
      config: ConnectionConfig,
    }

    Ok(ResponseModel::success(ConnectionConfigResult {
      id: entity.id,
      config: entity.config,
    }))
  }

  pub async fn test_connection(
    &self,
    config: ConnectionConfig,
  ) -> Result<ResponseModel, ResponseModel> {
    let health = Self::check_provider_health(&config).await;
    Ok(ResponseModel::success(health))
  }
}
