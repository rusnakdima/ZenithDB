use crate::commands::connection_entity::ConnectionEntity;
use rusqlite::{params, Connection};
use serde_json;
use std::path::PathBuf;

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
    Ok(Self { conn })
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
    tracing::info!("Initialized connections table");
    Ok(())
  }

  pub fn save(&self, entity: &ConnectionEntity) -> Result<(), String> {
    let config_json = serde_json::to_string(&entity.config).map_err(|e| e.to_string())?;

    self
      .conn
      .execute(
        "INSERT OR REPLACE INTO connections (id, type_, name, config, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
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

  pub fn find_all(&self) -> Result<Vec<ConnectionEntity>, String> {
    let mut stmt = self
      .conn
      .prepare("SELECT id, type_, name, config, created_at, updated_at FROM connections")
      .map_err(|e| e.to_string())?;

    let entities = stmt
      .query_map([], |row| {
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

  pub fn delete(&self, id: &str) -> Result<(), String> {
    self
      .conn
      .execute("DELETE FROM connections WHERE id = ?1", params![id])
      .map_err(|e| e.to_string())?;
    tracing::info!("Deleted connection: {}", id);
    Ok(())
  }

  pub fn exists(&self, id: &str) -> Result<bool, String> {
    let mut stmt = self
      .conn
      .prepare("SELECT 1 FROM connections WHERE id = ?1")
      .map_err(|e| e.to_string())?;
    let exists = stmt.exists(params![id]).map_err(|e| e.to_string())?;
    Ok(exists)
  }
}
