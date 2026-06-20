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
use crate::models::response::{Response, ResponseModel, Status};
use nosql_orm::prelude::*;
use rusqlite::{params, Connection};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::Mutex;
pub struct ConnectionService {
  connections_db: Arc<Mutex<ConnectionsDb>>,
}
struct ConnectionsDb {
  conn: Connection,
}
impl ConnectionsDb {
  fn new() -> Result<Self, String> {
    let db_path = Self::path()?;
    if let Some(parent) = db_path.parent() {
      std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn =
      Connection::open(&db_path).map_err(|e| format!("Failed to open connections db: {}", e))?;
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
        type_col TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      )",
        [],
      )
      .map_err(|e| e.to_string())?;
    Ok(())
  }
  fn save(&self, entity: &ConnectionEntity) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    self.conn.execute(
      "INSERT OR REPLACE INTO connections (id, type_col, name, config, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      params![
        entity.id,
        entity.type_,
        entity.name,
        entity.config,
        entity.created_at.map(|d| d.to_rfc3339()).unwrap_or_else(|| now.clone()),
        now,
      ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
  }
  fn find_by_id(&self, id: &str) -> Result<Option<ConnectionEntity>, String> {
    let mut stmt = self
      .conn
      .prepare(
        "SELECT id, type_col, name, config, created_at, updated_at FROM connections WHERE id = ?1",
      )
      .map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![id]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
      Ok(Some(self.row_to_entity(row)?))
    } else {
      Ok(None)
    }
  }
  fn find_all(&self) -> Result<Vec<ConnectionEntity>, String> {
    let mut stmt = self
      .conn
      .prepare("SELECT id, type_col, name, config, created_at, updated_at FROM connections")
      .map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    let mut entities = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
      entities.push(self.row_to_entity(row)?);
    }
    Ok(entities)
  }
  fn delete(&self, id: &str) -> Result<(), String> {
    self
      .conn
      .execute("DELETE FROM connections WHERE id = ?1", params![id])
      .map_err(|e| e.to_string())?;
    Ok(())
  }
  fn exists(&self, id: &str) -> Result<bool, String> {
    let mut stmt = self
      .conn
      .prepare("SELECT 1 FROM connections WHERE id = ?1")
      .map_err(|e| e.to_string())?;
    let exists = stmt.exists(params![id]).map_err(|e| e.to_string())?;
    Ok(exists)
  }
  fn row_to_entity(&self, row: &rusqlite::Row) -> Result<ConnectionEntity, String> {
    let created_at: Option<String> = row.get(4).map_err(|e| e.to_string())?;
    let updated_at: Option<String> = row.get(5).map_err(|e| e.to_string())?;
    Ok(ConnectionEntity {
      id: row.get(0).map_err(|e| e.to_string())?,
      type_: row.get(1).map_err(|e| e.to_string())?,
      name: row.get(2).map_err(|e| e.to_string())?,
      config: row.get(3).map_err(|e| e.to_string())?,
      created_at: created_at.and_then(|s| {
        chrono::DateTime::parse_from_rfc3339(&s)
          .ok()
          .map(|d| d.with_timezone(&chrono::Utc))
      }),
      updated_at: updated_at.and_then(|s| {
        chrono::DateTime::parse_from_rfc3339(&s)
          .ok()
          .map(|d| d.with_timezone(&chrono::Utc))
      }),
    })
  }
}
impl ConnectionService {
  pub fn new() -> Result<Self, String> {
    let db = ConnectionsDb::new()?;
    Ok(Self {
      connections_db: Arc::new(Mutex::new(db)),
    })
  }
  pub async fn get_instance() -> Arc<ConnectionService> {
    static SERVICE: tokio::sync::OnceCell<Arc<ConnectionService>> =
      tokio::sync::OnceCell::const_new();
    SERVICE
      .get_or_try_init(|| async { Self::new().map(Arc::new) })
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
  pub async fn save_connection(&self, config: ConnectionConfig) -> Result<Response, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let type_str = Self::get_type_string(&config);
    let entity = ConnectionEntity::new(id.clone(), type_str, config.name.clone(), config);
    let db = self.connections_db.lock().await;
    db.save(&entity).map_err(|e| e.to_string())?;
    Ok(Response::success(
      format!("Connection saved: {}", id),
      Value::Null,
    ))
  }
  pub async fn list_connections(&self) -> Result<Response, String> {
    let db = self.connections_db.lock().await;
    let entities = db.find_all().map_err(|e| e.to_string())?;
    drop(db);
    let mut summaries = Vec::new();
    for e in entities {
      let config: ConnectionConfig = match serde_json::from_str(&e.config) {
        Ok(c) => c,
        Err(_) => continue,
      };
      let health = self.check_provider_health(&config).await;
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
    Ok(Response::success(
      "Connections listed",
      serde_json::to_value(summaries).unwrap_or(Value::Null),
    ))
  }
  pub async fn test_connection_status(&self, id: &str) -> Result<Response, String> {
    let db = self.connections_db.lock().await;
    let entity = db
      .find_by_id(id)
      .map_err(|e| e.to_string())?
      .ok_or_else(|| format!("Connection {} not found", id))?;
    drop(db);
    let config: ConnectionConfig =
      serde_json::from_str(&entity.config).map_err(|e| format!("Failed to parse config: {}", e))?;
    let health = self.check_provider_health(&config).await;
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
    Ok(Response::success(
      "Connection status retrieved",
      serde_json::to_value(summary).unwrap_or(Value::Null),
    ))
  }
  pub async fn check_health(&self, conn_id: &str) -> Result<Response, String> {
    let db = self.connections_db.lock().await;
    let entity = db
      .find_by_id(conn_id)
      .map_err(|e| e.to_string())?
      .ok_or_else(|| format!("Connection {} not found", conn_id))?;
    drop(db);
    let config: ConnectionConfig =
      serde_json::from_str(&entity.config).map_err(|e| format!("Failed to parse config: {}", e))?;
    let health_result = tokio::time::timeout(
      std::time::Duration::from_secs(CONNECTION_TIMEOUT_SECS),
      async { self.check_provider_health(&config).await },
    )
    .await
    .map_err(|_| "Health check timed out".to_string())?;
    Ok(Response::success(
      "Health check completed",
      serde_json::to_value(health_result).unwrap_or(Value::Null),
    ))
  }
  pub async fn delete_connection(&self, id: &str) -> Result<Response, String> {
    let db = self.connections_db.lock().await;
    if !db.exists(id).map_err(|e| e.to_string())? {
      return Err(format!("Connection {} not found", id));
    }
    db.delete(id).map_err(|e| e.to_string())?;
    drop(db);
    if let Err(e) = delete_connection_databases_metadata(id.to_string()).await {};
    Ok(Response::success(
      format!("Connection {} deleted", id),
      Value::Null,
    ))
  }
  pub async fn update_connection(
    &self,
    id: &str,
    config: ConnectionConfig,
  ) -> Result<Response, String> {
    let db = self.connections_db.lock().await;
    let existing = db
      .find_by_id(id)
      .map_err(|e| e.to_string())?
      .ok_or_else(|| format!("Connection {} not found", id))?;
    let type_str = Self::get_type_string(&config);
    let config_json = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    let entity = ConnectionEntity {
      id: Some(id.to_string()),
      type_: type_str,
      name: config.name.clone(),
      config: config_json,
      created_at: existing.created_at,
      updated_at: Some(chrono::Utc::now()),
    };
    db.save(&entity).map_err(|e| e.to_string())?;
    drop(db);
    Ok(Response::success(
      format!("Connection {} updated", id),
      Value::Null,
    ))
  }
  pub async fn get_connection(&self, id: &str) -> Result<Response, String> {
    let db = self.connections_db.lock().await;
    let entity = db
      .find_by_id(id)
      .map_err(|e| e.to_string())?
      .ok_or_else(|| format!("Connection {} not found", id))?;
    drop(db);
    #[derive(serde::Serialize)]
    struct ConnectionConfigResult {
      id: String,
      config: ConnectionConfig,
    }
    let config: ConnectionConfig =
      serde_json::from_str(&entity.config).map_err(|e| format!("Failed to parse config: {}", e))?;
    Ok(Response::success(
      "Connection retrieved",
      serde_json::to_value(ConnectionConfigResult {
        id: entity.id.unwrap_or_default(),
        config,
      })
      .unwrap_or(Value::Null),
    ))
  }
  pub async fn test_connection(&self, config: ConnectionConfig) -> Result<Response, String> {
    let health = self.check_provider_health(&config).await;
    Ok(Response::success(
      "Connection tested",
      serde_json::to_value(health).unwrap_or(Value::Null),
    ))
  }
  pub async fn find_entity_by_id(&self, id: &str) -> Result<Option<ConnectionEntity>, String> {
    let db = self.connections_db.lock().await;
    db.find_by_id(id)
  }
}
