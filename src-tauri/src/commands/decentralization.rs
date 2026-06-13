use crate::constants::LIST_TIMEOUT_SECS;
use crate::logger::{redact_sensitive_data, DataflowTimer};
use crate::models::response::ResponseModel;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseMetadata {
  pub id: i64,
  pub connection_id: String,
  pub name: String,
  pub path: Option<String>,
  pub created_at: i64,
  pub updated_at: i64,
  pub metadata: Option<String>,
}

pub struct DecentralizedStorage;

impl DecentralizedStorage {
  pub fn path() -> PathBuf {
    dirs::home_dir()
      .unwrap_or_else(|| PathBuf::from("."))
      .join(".zenithdb")
      .join("metadata.db")
  }

  pub async fn init() -> Result<(), String> {
    let path = Self::path();

    if let Some(parent) = path.parent() {
      tokio::fs::create_dir_all(parent)
        .await
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let path_clone = path.clone();
    tokio::task::spawn_blocking(move || {
      let conn =
        Connection::open(&path_clone).map_err(|e| format!("Failed to open database: {}", e))?;

      conn
        .execute(
          "CREATE TABLE IF NOT EXISTS database_metadata (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    connection_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    path TEXT,
                    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                    metadata TEXT
                )",
          [],
        )
        .map_err(|e| format!("Failed to create table: {}", e))?;

      conn
        .execute(
          "CREATE INDEX IF NOT EXISTS idx_connection_id ON database_metadata(connection_id)",
          [],
        )
        .map_err(|e| format!("Failed to create index: {}", e))?;

      Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Init task failed: {:?}", e))?
  }

  pub async fn save_database(
    connection_id: &str,
    name: &str,
    path: Option<&str>,
    metadata: Option<&str>,
  ) -> Result<DatabaseMetadata, String> {
    let db_path = Self::path();
    let conn_id = connection_id.to_string();
    let db_name = name.to_string();
    let db_path_owned = path.map(|p| p.to_string());
    let db_metadata_owned = metadata.map(|m| m.to_string());
    let now = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map_err(|e| format!("Time error: {}", e))?
      .as_secs() as i64;

    let result_conn_id = conn_id.clone();
    let result_db_name = db_name.clone();
    let result_path = db_path_owned.clone();
    let result_metadata = db_metadata_owned.clone();

    tokio::task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .map_err(|e| format!("Failed to open database: {}", e))?;

            conn.execute(
                "INSERT INTO database_metadata (connection_id, name, path, created_at, updated_at, metadata) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![conn_id, db_name, db_path_owned, now, now, db_metadata_owned],
            )
            .map_err(|e| format!("Failed to insert database: {}", e))?;

            let id = conn.last_insert_rowid();

            Ok::<DatabaseMetadata, String>(DatabaseMetadata {
                id,
                connection_id: result_conn_id,
                name: result_db_name,
                path: result_path,
                created_at: now,
                updated_at: now,
                metadata: result_metadata,
            })
        })
        .await
        .map_err(|e| format!("save_database task failed: {:?}", e))?
  }

  pub async fn list_databases(connection_id: &str) -> Result<Vec<DatabaseMetadata>, String> {
    let db_path = Self::path();
    let conn_id = connection_id.to_string();

    tokio::task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .map_err(|e| format!("Failed to open database: {}", e))?;

            let mut stmt = conn
                .prepare("SELECT id, connection_id, name, path, created_at, updated_at, metadata FROM database_metadata WHERE connection_id = ?1 ORDER BY created_at DESC")
                .map_err(|e| format!("Failed to prepare statement: {}", e))?;

            let rows = stmt
                .query_map(params![conn_id], |row| {
                    Ok(DatabaseMetadata {
                        id: row.get(0)?,
                        connection_id: row.get(1)?,
                        name: row.get(2)?,
                        path: row.get(3)?,
                        created_at: row.get(4)?,
                        updated_at: row.get(5)?,
                        metadata: row.get(6)?,
                    })
                })
                .map_err(|e| format!("Failed to query: {}", e))?;

            let mut databases = Vec::new();
            for row in rows {
                databases.push(row.map_err(|e| format!("Failed to read row: {}", e))?);
            }

            Ok(databases)
        })
        .await
        .map_err(|e| format!("list_databases task failed: {:?}", e))?
  }

  pub async fn get_database(id: i64) -> Result<Option<DatabaseMetadata>, String> {
    let db_path = Self::path();

    tokio::task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .map_err(|e| format!("Failed to open database: {}", e))?;

            let mut stmt = conn
                .prepare("SELECT id, connection_id, name, path, created_at, updated_at, metadata FROM database_metadata WHERE id = ?1")
                .map_err(|e| format!("Failed to prepare statement: {}", e))?;

            let result = stmt
                .query_row(params![id], |row| {
                    Ok(DatabaseMetadata {
                        id: row.get(0)?,
                        connection_id: row.get(1)?,
                        name: row.get(2)?,
                        path: row.get(3)?,
                        created_at: row.get(4)?,
                        updated_at: row.get(5)?,
                        metadata: row.get(6)?,
                    })
                })
                .optional()
                .map_err(|e| format!("Failed to query: {}", e))?;

            Ok(result)
        })
        .await
        .map_err(|e| format!("get_database task failed: {:?}", e))?
  }

  pub async fn update_database(
    id: i64,
    name: &str,
    path: Option<&str>,
    metadata: Option<&str>,
  ) -> Result<DatabaseMetadata, String> {
    let db_path = Self::path();
    let now = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map_err(|e| format!("Time error: {}", e))?
      .as_secs() as i64;

    let name_owned = name.to_string();
    let path_owned = path.map(|p| p.to_string());
    let metadata_owned = metadata.map(|m| m.to_string());

    tokio::task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .map_err(|e| format!("Failed to open database: {}", e))?;

            conn.execute(
                "UPDATE database_metadata SET name = ?1, path = ?2, updated_at = ?3, metadata = ?4 WHERE id = ?5",
                params![name_owned, path_owned, now, metadata_owned, id],
            )
            .map_err(|e| format!("Failed to update database: {}", e))?;

            let mut stmt = conn
                .prepare("SELECT id, connection_id, name, path, created_at, updated_at, metadata FROM database_metadata WHERE id = ?1")
                .map_err(|e| format!("Failed to prepare statement: {}", e))?;

            stmt.query_row(params![id], |row| {
                Ok(DatabaseMetadata {
                    id: row.get(0)?,
                    connection_id: row.get(1)?,
                    name: row.get(2)?,
                    path: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    metadata: row.get(6)?,
                })
            })
            .map_err(|e| format!("Database not found after update: {}", e))
        })
        .await
        .map_err(|e| format!("update_database task failed: {:?}", e))?
  }

  pub async fn delete_database(id: i64) -> Result<(), String> {
    let db_path = Self::path();

    tokio::task::spawn_blocking(move || {
      let conn =
        Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

      conn
        .execute("DELETE FROM database_metadata WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete database: {}", e))?;

      Ok(())
    })
    .await
    .map_err(|e| format!("delete_database task failed: {:?}", e))?
  }

  pub async fn delete_connection_databases(connection_id: &str) -> Result<(), String> {
    let db_path = Self::path();
    let conn_id = connection_id.to_string();

    tokio::task::spawn_blocking(move || {
      let conn =
        Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

      conn
        .execute(
          "DELETE FROM database_metadata WHERE connection_id = ?1",
          params![conn_id],
        )
        .map_err(|e| format!("Failed to delete connection databases: {}", e))?;

      Ok(())
    })
    .await
    .map_err(|e| format!("delete_connection_databases task failed: {:?}", e))?
  }
}

#[tauri::command]
pub async fn init_decentralized_storage() -> Result<(), String> {
  let timer = DataflowTimer::new("init_decentralized_storage");
  tracing::debug!(command = "init_decentralized_storage", "[COMMAND_ENTRY]");
  match DecentralizedStorage::init().await {
    Ok(()) => {
      timer.finish(&ResponseModel::success(()));
      Ok(())
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}

#[tauri::command]
pub async fn save_database_metadata(
  connection_id: String,
  name: String,
  path: Option<String>,
  metadata: Option<String>,
) -> Result<DatabaseMetadata, String> {
  let timer = DataflowTimer::new("save_database_metadata");
  let params = serde_json::json!({ "connection_id": &connection_id, "name": &name, "path": path, "metadata": metadata });
  tracing::debug!(command = "save_database_metadata", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  match DecentralizedStorage::save_database(
    &connection_id,
    &name,
    path.as_deref(),
    metadata.as_deref(),
  )
  .await
  {
    Ok(result) => {
      timer.finish(&ResponseModel::success(&result));
      Ok(result)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}

#[tauri::command]
pub async fn list_databases_metadata(
  connection_id: String,
) -> Result<Vec<DatabaseMetadata>, String> {
  let timer = DataflowTimer::new("list_databases_metadata");
  let params = serde_json::json!({ "connection_id": &connection_id });
  tracing::debug!(command = "list_databases_metadata", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  match tokio::time::timeout(
    std::time::Duration::from_secs(LIST_TIMEOUT_SECS),
    DecentralizedStorage::list_databases(&connection_id),
  )
  .await
  {
    Ok(Ok(result)) => {
      timer.finish(&ResponseModel::success(&result));
      Ok(result)
    }
    Ok(Err(e)) => {
      timer.finish_error(&e);
      Err(e)
    }
    Err(_) => {
      let e = "List databases timed out".to_string();
      timer.finish_error(&e);
      Err(e)
    }
  }
}

#[tauri::command]
pub async fn get_database_metadata(id: i64) -> Result<Option<DatabaseMetadata>, String> {
  let timer = DataflowTimer::new("get_database_metadata");
  let params = serde_json::json!({ "id": id });
  tracing::debug!(command = "get_database_metadata", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  match DecentralizedStorage::get_database(id).await {
    Ok(result) => {
      timer.finish(&ResponseModel::success(&result));
      Ok(result)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}

#[tauri::command]
pub async fn update_database_metadata(
  id: i64,
  name: String,
  path: Option<String>,
  metadata: Option<String>,
) -> Result<DatabaseMetadata, String> {
  let timer = DataflowTimer::new("update_database_metadata");
  let params = serde_json::json!({ "id": id, "name": &name, "path": path, "metadata": metadata });
  tracing::debug!(command = "update_database_metadata", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  match DecentralizedStorage::update_database(id, &name, path.as_deref(), metadata.as_deref()).await
  {
    Ok(result) => {
      timer.finish(&ResponseModel::success(&result));
      Ok(result)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}

#[tauri::command]
pub async fn delete_database_metadata(id: i64) -> Result<(), String> {
  let timer = DataflowTimer::new("delete_database_metadata");
  let params = serde_json::json!({ "id": id });
  tracing::debug!(command = "delete_database_metadata", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  match DecentralizedStorage::delete_database(id).await {
    Ok(()) => {
      timer.finish(&ResponseModel::success(()));
      Ok(())
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}

#[tauri::command]
pub async fn delete_connection_databases_metadata(connection_id: String) -> Result<(), String> {
  let timer = DataflowTimer::new("delete_connection_databases_metadata");
  let params = serde_json::json!({ "connection_id": &connection_id });
  tracing::debug!(command = "delete_connection_databases_metadata", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");
  match DecentralizedStorage::delete_connection_databases(&connection_id).await {
    Ok(()) => {
      timer.finish(&ResponseModel::success(()));
      Ok(())
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
