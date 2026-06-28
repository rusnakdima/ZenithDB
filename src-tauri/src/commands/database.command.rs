use crate::commands::connection_command::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::types::DatabaseMeta;
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::models::response::{success, ResponseModel};
use crate::services::infrastructure::nosql_orm_adapter::NosqlOrmAdapter;
use crate::utils::metrics::DataflowTimer;
use nosql_orm::prelude::*;
use serde_json::Value;
use std::path::PathBuf;
fn validate_safe_path(base: &str, user_input: &str) -> Result<PathBuf, String> {
  crate::services::infrastructure::nosql_orm_adapter::validate_safe_path(base, user_input)
}
fn list_databases_with_pagination(
  db_names: Vec<String>,
  offset: usize,
  limit: usize,
) -> DatabaseListResult {
  let total_count = db_names.len();
  let has_more = offset + limit < total_count;
  let dbs: Vec<DatabaseMeta> = db_names
    .into_iter()
    .skip(offset)
    .take(limit)
    .map(|name| DatabaseMeta {
      name,
      size_bytes: None,
      table_count: None,
    })
    .collect();
  DatabaseListResult {
    databases: dbs,
    has_more,
    total_count,
  }
}
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DatabaseListResult {
  pub databases: Vec<DatabaseMeta>,
  pub has_more: bool,
  pub total_count: usize,
}
const MAX_DIRS_PER_LEVEL: usize = 10;
const SCAN_TIMEOUT_SECS: u64 = 30;
#[tauri::command]
pub async fn create_database(connection_id: &str, name: &str) -> Result<ResponseModel, String> {
  let timer = DataflowTimer::new("create_database");
  let result = (|| async {
    validate_conn_id(connection_id).map_err(|e| e.to_string())?;
    validate_name(name).map_err(|e| e.to_string())?;
    let entry = get_connection_entry(connection_id)
      .await
      .map_err(|e| e.to_string())?;
    match &entry.config.config {
      ConnectionConfigEnum::Sqlite { path, .. } => {
        if !std::path::Path::new(path).exists() {
          tokio::fs::File::create(path)
            .await
            .map_err(|e| e.to_string())?;
        }
        Ok(success("Database created", Value::Null))
      }
      ConnectionConfigEnum::Json { path, .. } => NosqlOrmAdapter::create_database_json(path, name)
        .await
        .map(|_| success("Database created", Value::Null))
        .map_err(|e| e.to_string()),
      ConnectionConfigEnum::Redis { .. } => Ok(success("Database created", Value::Null)),
      ConnectionConfigEnum::Mongo { uri, .. } => {
        let provider = crate::commands::provider::create_mongo_provider(uri, &name)
          .await
          .map_err(|e| e.to_string())?;
        provider
          .execute_raw("create", vec![])
          .await
          .map_err(|e| e.to_string())?;
        Ok(success("Database created", Value::Null))
      }
      ConnectionConfigEnum::Postgres { uri, .. } => {
        let provider = crate::commands::provider::create_postgres_provider(uri)
          .await
          .map_err(|e| e.to_string())?;
        provider
          .execute_raw(&format!("CREATE DATABASE \"{}\"", name), vec![])
          .await
          .map_err(|e| e.to_string())?;
        Ok(success("Database created", Value::Null))
      }
      ConnectionConfigEnum::MySql { uri, .. } => {
        let provider = crate::commands::provider::create_mysql_provider(uri)
          .await
          .map_err(|e| e.to_string())?;
        provider
          .execute_raw(&format!("CREATE DATABASE IF NOT EXISTS `{}`", name), vec![])
          .await
          .map_err(|e| e.to_string())?;
        Ok(success("Database created", Value::Null))
      }
    }
  })()
  .await;
  match &result {
    Ok(resp) => timer.finish_success(),
    Err(err) => timer.finish_error(err),
  }
  result
}
#[tauri::command]
pub async fn rename_database(
  connection_id: &str,
  old_name: &str,
  new_name: &str,
) -> Result<ResponseModel, String> {
  let timer = DataflowTimer::new("rename_database");
  let result = (|| async {
    validate_conn_id(connection_id).map_err(|e| e.to_string())?;
    validate_name(old_name).map_err(|e| e.to_string())?;
    validate_name(new_name).map_err(|e| e.to_string())?;
    let entry = get_connection_entry(connection_id)
      .await
      .map_err(|e| e.to_string())?;
    match &entry.config.config {
      ConnectionConfigEnum::Sqlite { .. } => Err(
        "SQLite database cannot be renamed. Create a new connection with a different file path.".to_string(),
      ),
      ConnectionConfigEnum::Json { path, .. } => {
        let old_path = validate_safe_path(path, old_name).map_err(|e| e.to_string())?;
        let new_path = validate_safe_path(path, new_name).map_err(|e| e.to_string())?;
        if old_path.exists() {
          tokio::fs::rename(&old_path, &new_path)
            .await
            .map_err(|e| e.to_string())?;
        }
        Ok(success("Database renamed", Value::Null))
      }
      ConnectionConfigEnum::Redis { .. } => Err(
        "Redis does not support renaming databases.".to_string(),
      ),
      ConnectionConfigEnum::Mongo { uri: _, .. } => Err(
        "MongoDB does not support renaming databases via this interface.".to_string(),
      ),
      ConnectionConfigEnum::Postgres { uri, .. } => {
        let provider = crate::commands::provider::create_postgres_provider(uri)
          .await
          .map_err(|e| e.to_string())?;
        provider
          .execute_raw(
            &format!("ALTER DATABASE \"{}\" RENAME TO \"{}\"", old_name, new_name),
            vec![],
          )
          .await
          .map_err(|e| e.to_string())?;
        Ok(success("Database renamed", Value::Null))
      }
      ConnectionConfigEnum::MySql { uri: _, .. } => Err(
        "MySQL does not support renaming databases directly. Create a new database and migrate data.".to_string(),
      ),
    }
  })().await;
  match &result {
    Ok(resp) => timer.finish_success(),
    Err(err) => timer.finish_error(err),
  }
  result
}
#[tauri::command]
pub async fn delete_database(connection_id: &str, name: &str) -> Result<ResponseModel, String> {
  let timer = DataflowTimer::new("delete_database");
  let result = (|| async {
    validate_conn_id(connection_id).map_err(|e| e.to_string())?;
    validate_name(name).map_err(|e| e.to_string())?;
    let entry = get_connection_entry(connection_id)
      .await
      .map_err(|e| e.to_string())?;
    match &entry.config.config {
      ConnectionConfigEnum::Sqlite { .. } => Err(
        "SQLite database cannot be deleted. Delete the connection and remove the file.".to_string(),
      ),
      ConnectionConfigEnum::Json { path, .. } => NosqlOrmAdapter::drop_database_json(path, name)
        .await
        .map(|_| success("Database deleted", Value::Null))
        .map_err(|e| e.to_string()),
      ConnectionConfigEnum::Redis { .. } => {
        Err("Redis does not support deleting databases.".to_string())
      }
      ConnectionConfigEnum::Mongo { .. } => {
        Err("MongoDB database deletion is not supported via this interface.".to_string())
      }
      ConnectionConfigEnum::Postgres { uri, .. } => {
        let provider = crate::commands::provider::create_postgres_provider(uri)
          .await
          .map_err(|e| e.to_string())?;
        provider
          .execute_raw(&format!("DROP DATABASE \"{}\"", name), vec![])
          .await
          .map_err(|e| e.to_string())?;
        Ok(success("Database deleted", Value::Null))
      }
      ConnectionConfigEnum::MySql { uri, .. } => {
        let provider = crate::commands::provider::create_mysql_provider(uri)
          .await
          .map_err(|e| e.to_string())?;
        provider
          .execute_raw(&format!("DROP DATABASE IF EXISTS `{}`", name), vec![])
          .await
          .map_err(|e| e.to_string())?;
        Ok(success("Database deleted", Value::Null))
      }
    }
  })()
  .await;
  match &result {
    Ok(resp) => timer.finish_success(),
    Err(err) => timer.finish_error(err),
  }
  result
}
#[tauri::command]
pub async fn database_list(
  conn_id: String,
  offset: Option<usize>,
  limit: Option<usize>,
) -> Result<ResponseModel, String> {
  let timer = DataflowTimer::new("database_list");
  let params = serde_json::json!({ "conn_id": &conn_id, "offset": offset, "limit": limit });
  if let Err(e) = validate_conn_id(&conn_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&conn_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  let offset = offset.unwrap_or(0);
  let limit = limit.unwrap_or(MAX_DIRS_PER_LEVEL);
  let result = match &entry.config.config {
    ConnectionConfigEnum::Json { path, .. } => {
      let path_obj = std::path::Path::new(path).to_path_buf();
      if !path_obj.is_dir() {
        return Ok(success(
          "",
          serde_json::to_value(DatabaseListResult {
            databases: Vec::new(),
            has_more: false,
            total_count: 0,
          })
          .unwrap_or(serde_json::Value::Null),
        ));
      }
      match list_json_databases(path_obj.clone(), offset, limit).await {
        Ok(r) => success(
          "Databases listed",
          serde_json::to_value(r).unwrap_or(serde_json::Value::Null),
        ),
        Err(e) => {
          timer.clone().finish_error(&e);
          return Err(e);
        }
      }
    }
    ConnectionConfigEnum::Sqlite { path, .. } => success(
      "Databases listed",
      serde_json::to_value(DatabaseListResult {
        databases: vec![DatabaseMeta::from_name(
          std::path::Path::new(path)
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("database"),
        )],
        has_more: false,
        total_count: 1,
      })
      .unwrap_or(serde_json::Value::Null),
    ),
    ConnectionConfigEnum::Redis { .. } => success(
      "Databases listed",
      serde_json::to_value(DatabaseListResult {
        databases: vec![DatabaseMeta::from_name("default")],
        has_more: false,
        total_count: 1,
      })
      .unwrap_or(serde_json::Value::Null),
    ),
    ConnectionConfigEnum::Mongo { uri, .. } => {
      match crate::commands::provider::get_or_create_mongo_provider(&conn_id, uri, "admin").await {
        Ok(provider) => match provider.list_databases().await.map_err_string() {
          Ok(db_names) => success(
            "Databases listed",
            serde_json::to_value(list_databases_with_pagination(db_names, offset, limit))
              .unwrap_or(serde_json::Value::Null),
          ),
          Err(e) => {
            timer.clone().finish_error(&e);
            return Err(e);
          }
        },
        Err(e) => {
          timer.clone().finish_error(&e.to_string());
          return Err(e.to_string());
        }
      }
    }
    ConnectionConfigEnum::Postgres { uri, .. } => {
      match crate::commands::provider::get_or_create_postgres_provider(&conn_id, uri).await {
        Ok(provider) => match provider.list_databases().await.map_err_string() {
          Ok(db_names) => success(
            "Databases listed",
            serde_json::to_value(list_databases_with_pagination(db_names, offset, limit))
              .unwrap_or(serde_json::Value::Null),
          ),
          Err(e) => {
            timer.clone().finish_error(&e);
            return Err(e);
          }
        },
        Err(e) => {
          timer.clone().finish_error(&e.to_string());
          return Err(e.to_string());
        }
      }
    }
    ConnectionConfigEnum::MySql { uri, .. } => {
      match crate::commands::provider::get_or_create_mysql_provider(&conn_id, uri).await {
        Ok(provider) => match provider.list_databases().await.map_err_string() {
          Ok(db_names) => success(
            "Databases listed",
            serde_json::to_value(list_databases_with_pagination(db_names, offset, limit))
              .unwrap_or(serde_json::Value::Null),
          ),
          Err(e) => {
            timer.clone().finish_error(&e);
            return Err(e);
          }
        },
        Err(e) => {
          timer.clone().finish_error(&e.to_string());
          return Err(e.to_string());
        }
      }
    }
  };
  timer.finish_success();
  Ok(result)
}
async fn list_json_databases(
  path_obj: std::path::PathBuf,
  offset: usize,
  limit: usize,
) -> Result<DatabaseListResult, String> {
  let timeout_result =
    tokio::time::timeout(std::time::Duration::from_secs(SCAN_TIMEOUT_SECS), async {
      let mut databases: Vec<DatabaseMeta> = Vec::new();
      let mut entries = match tokio::fs::read_dir(&path_obj).await {
        Ok(e) => e,
        Err(_) => {
          return Ok(DatabaseListResult {
            databases: Vec::new(),
            has_more: false,
            total_count: 0,
          })
        }
      };
      let mut total_count = 0usize;
      let mut has_json_files = false;
      while let Some(entry) = entries.next_entry().await.map_err_string()? {
        let entry_path = entry.path();
        if entry_path.is_dir() {
          total_count += 1;
          if databases.len() < limit * 2 {
            let name = entry.file_name().into_string().ok().map(|n| n.to_string());
            if let Some(name) = name {
              databases.push(DatabaseMeta::from_name(&name));
            }
          }
        } else if let Some(ext) = entry_path.extension() {
          if ext == "json" {
            has_json_files = true;
          }
        }
      }
      if databases.is_empty() && has_json_files {
        if let Some(folder_name) = path_obj.file_name().and_then(|n| n.to_str()) {
          databases.push(DatabaseMeta::from_name(folder_name));
          total_count = 1;
        }
      }
      databases.sort_by(|a, b| a.name.cmp(&b.name));
      let has_more = offset + limit < total_count;
      let result = databases.into_iter().skip(offset).take(limit).collect();
      Ok(DatabaseListResult {
        databases: result,
        has_more,
        total_count,
      })
    })
    .await;
  match timeout_result {
    Ok(Ok(result)) => Ok(result),
    Ok(Err(e)) => Err(e),
    Err(_) => Err("Database listing timed out".to_string()),
  }
}
