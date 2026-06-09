use crate::commands::connection_entity::ConnectionEntity;
use rusqlite::{params, Connection};
use serde_json;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct ConnectionsDb {
  conn: Connection,
}

impl ConnectionsDb {
  pub fn new() -> Result<Self, String> {
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

  fn path() -> Result<PathBuf, String> {
    let path = dirs::home_dir()
      .ok_or("Failed to get home dir")?
      .join(".zenithdb")
      .join("connections.db");
    Ok(path)
  }

  pub fn init(&self) -> Result<(), String> {
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

  pub fn find_by_id(&self, id: &str) -> Result<Option<ConnectionEntity>, String> {
    let mut stmt = self
      .conn
      .prepare(
        "SELECT id, type_, name, config, created_at, updated_at FROM connections WHERE id = ?1",
      )
      .map_err(|e| e.to_string())?;

    let result = stmt.query_row(params![id], |row| {
      let config_json: String = row.get(3)?;
      let config: crate::commands::connection::ConnectionConfig =
        serde_json::from_str(&config_json).map_err(|e| {
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
}

static CONNECTIONS_DB: std::sync::OnceLock<Arc<Mutex<ConnectionsDb>>> = std::sync::OnceLock::new();

pub async fn get_connections_db() -> Result<Arc<Mutex<ConnectionsDb>>, String> {
  let db = CONNECTIONS_DB.get_or_init(|| Arc::new(Mutex::new(ConnectionsDb::new().unwrap())));
  Ok(db.clone())
}
