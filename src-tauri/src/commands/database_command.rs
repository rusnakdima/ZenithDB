use crate::commands::connection_command::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::types::DatabaseMeta;
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::infrastructure::nosql_orm_adapter::NosqlOrmAdapter;
use crate::logger::DataflowTimer;
use crate::models::response::ResponseModel;
use nosql_orm::prelude::*;
use std::path::PathBuf;

fn validate_safe_path(base: &str, user_input: &str) -> Result<PathBuf, String> {
  crate::infrastructure::nosql_orm_adapter::validate_safe_path(base, user_input)
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
pub async fn create_database(
  connection_id: &str,
  name: &str,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("create_database");
  let result = (|| async {
    validate_conn_id(connection_id).map_err(|e| ResponseModel::error(e))?;
    validate_name(name).map_err(|e| ResponseModel::error(e))?;
    let entry = get_connection_entry(connection_id)
      .await
      .map_err(|e| ResponseModel::error(e))?;

    match &entry.config.config {
      ConnectionConfigEnum::Sqlite { path, .. } => {
        if !std::path::Path::new(path).exists() {
          tokio::fs::File::create(path)
            .await
            .map_err(|e| ResponseModel::error(e.to_string()))?;
        }
        Ok(ResponseModel::success_message("Database created"))
      }
      ConnectionConfigEnum::Json { path, .. } => NosqlOrmAdapter::create_database_json(path, name)
        .await
        .map(|_| ResponseModel::success_message("Database created"))
        .map_err(|e| ResponseModel::error(e.to_string())),
      ConnectionConfigEnum::Redis { .. } => Ok(ResponseModel::success_message("Database created")),
      ConnectionConfigEnum::Mongo { uri, .. } => {
        let provider = crate::commands::provider::create_mongo_provider(uri, &name)
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
        provider
          .execute_raw("create", vec![])
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
        Ok(ResponseModel::success_message("Database created"))
      }
      ConnectionConfigEnum::Postgres { uri, .. } => {
        let provider = crate::commands::provider::create_postgres_provider(uri)
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
        provider
          .execute_raw(&format!("CREATE DATABASE \"{}\"", name), vec![])
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
        Ok(ResponseModel::success_message("Database created"))
      }
      ConnectionConfigEnum::MySql { uri, .. } => {
        let provider = crate::commands::provider::create_mysql_provider(uri)
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
        provider
          .execute_raw(&format!("CREATE DATABASE IF NOT EXISTS `{}`", name), vec![])
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
        Ok(ResponseModel::success_message("Database created"))
      }
    }
  })()
  .await;
  match &result {
    Ok(resp) => timer.finish(resp),
    Err(err) => timer.finish_error(&err.message),
  }
  result
}

#[tauri::command]
pub async fn rename_database(
  connection_id: &str,
  old_name: &str,
  new_name: &str,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("rename_database");
  let result = (|| async {
    validate_conn_id(connection_id).map_err(|e| ResponseModel::error(e))?;
    validate_name(old_name).map_err(|e| ResponseModel::error(e))?;
    validate_name(new_name).map_err(|e| ResponseModel::error(e))?;
    let entry = get_connection_entry(connection_id)
      .await
      .map_err(|e| ResponseModel::error(e))?;

    match &entry.config.config {
      ConnectionConfigEnum::Sqlite { .. } => Err(ResponseModel::error(
        "SQLite database cannot be renamed. Create a new connection with a different file path.",
      )),
      ConnectionConfigEnum::Json { path, .. } => {
        let old_path = validate_safe_path(path, old_name).map_err(|e| ResponseModel::error(e))?;
        let new_path = validate_safe_path(path, new_name).map_err(|e| ResponseModel::error(e))?;
        if old_path.exists() {
          tokio::fs::rename(&old_path, &new_path)
            .await
            .map_err(|e| ResponseModel::error(e.to_string()))?;
        }
        Ok(ResponseModel::success_message("Database renamed"))
      }
      ConnectionConfigEnum::Redis { .. } => Err(ResponseModel::error(
        "Redis does not support renaming databases.",
      )),
      ConnectionConfigEnum::Mongo { uri: _, .. } => Err(ResponseModel::error(
        "MongoDB does not support renaming databases via this interface.",
      )),
      ConnectionConfigEnum::Postgres { uri, .. } => {
        let provider = crate::commands::provider::create_postgres_provider(uri)
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
        provider
          .execute_raw(
            &format!("ALTER DATABASE \"{}\" RENAME TO \"{}\"", old_name, new_name),
            vec![],
          )
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
        Ok(ResponseModel::success_message("Database renamed"))
      }
      ConnectionConfigEnum::MySql { uri: _, .. } => Err(ResponseModel::error(
        "MySQL does not support renaming databases directly. Create a new database and migrate data.",
      )),
    }
  })().await;
  match &result {
    Ok(resp) => timer.finish(resp),
    Err(err) => timer.finish_error(&err.message),
  }
  result
}

#[tauri::command]
pub async fn delete_database(
  connection_id: &str,
  name: &str,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("delete_database");
  let result = (|| async {
    validate_conn_id(connection_id).map_err(|e| ResponseModel::error(e))?;
    validate_name(name).map_err(|e| ResponseModel::error(e))?;
    let entry = get_connection_entry(connection_id)
      .await
      .map_err(|e| ResponseModel::error(e))?;

    match &entry.config.config {
      ConnectionConfigEnum::Sqlite { .. } => Err(ResponseModel::error(
        "SQLite database cannot be deleted. Delete the connection and remove the file.",
      )),
      ConnectionConfigEnum::Json { path, .. } => NosqlOrmAdapter::drop_database_json(path, name)
        .await
        .map(|_| ResponseModel::success_message("Database deleted"))
        .map_err(|e| ResponseModel::error(e.to_string())),
      ConnectionConfigEnum::Redis { .. } => Err(ResponseModel::error(
        "Redis does not support deleting databases.",
      )),
      ConnectionConfigEnum::Mongo { .. } => Err(ResponseModel::error(
        "MongoDB database deletion is not supported via this interface.",
      )),
      ConnectionConfigEnum::Postgres { uri, .. } => {
        let provider = crate::commands::provider::create_postgres_provider(uri)
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
        provider
          .execute_raw(&format!("DROP DATABASE \"{}\"", name), vec![])
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
        Ok(ResponseModel::success_message("Database deleted"))
      }
      ConnectionConfigEnum::MySql { uri, .. } => {
        let provider = crate::commands::provider::create_mysql_provider(uri)
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
        provider
          .execute_raw(&format!("DROP DATABASE IF EXISTS `{}`", name), vec![])
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
        Ok(ResponseModel::success_message("Database deleted"))
      }
    }
  })()
  .await;
  match &result {
    Ok(resp) => timer.finish(resp),
    Err(err) => timer.finish_error(&err.message),
  }
  result
}

#[tauri::command]
pub async fn database_list(
  connection_id: String,
  offset: Option<usize>,
  limit: Option<usize>,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("database_list");
  let params =
    serde_json::json!({ "connection_id": &connection_id, "offset": offset, "limit": limit });
  log::debug!(
    "command = database_list, params = {} [COMMAND_ENTRY]",
    crate::logger::redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  let entry = match get_connection_entry(&connection_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(ResponseModel::error(e));
    }
  };
  let offset = offset.unwrap_or(0);
  let limit = limit.unwrap_or(MAX_DIRS_PER_LEVEL);

  let result = match &entry.config.config {
    ConnectionConfigEnum::Json { path, .. } => {
      let path_obj = std::path::Path::new(path).to_path_buf();
      if !path_obj.is_dir() {
        return Ok(ResponseModel::success(DatabaseListResult {
          databases: Vec::new(),
          has_more: false,
          total_count: 0,
        }));
      }

      match list_json_databases(path_obj.clone(), offset, limit).await {
        Ok(r) => ResponseModel::success(r),
        Err(e) => {
          timer.clone().finish_error(&e);
          ResponseModel::error(e)
        }
      }
    }
    ConnectionConfigEnum::Sqlite { path, .. } => ResponseModel::success(DatabaseListResult {
      databases: vec![DatabaseMeta::from_name(
        std::path::Path::new(path)
          .file_stem()
          .and_then(|n| n.to_str())
          .unwrap_or("database"),
      )],
      has_more: false,
      total_count: 1,
    }),
    ConnectionConfigEnum::Redis { .. } => ResponseModel::success(DatabaseListResult {
      databases: vec![DatabaseMeta::from_name("default")],
      has_more: false,
      total_count: 1,
    }),
    ConnectionConfigEnum::Mongo { uri, .. } => {
      match crate::commands::provider::get_or_create_mongo_provider(&connection_id, uri, "admin")
        .await
      {
        Ok(provider) => match provider.list_databases().await.map_err_string() {
          Ok(db_names) => ResponseModel::success(list_databases_with_pagination(db_names, offset, limit)),
          Err(e) => {
            timer.clone().finish_error(&e);
            ResponseModel::error(e.to_string())
          }
        },
        Err(e) => {
          timer.clone().finish_error(&e.to_string());
          ResponseModel::error(e.to_string())
        }
      }
    }
    ConnectionConfigEnum::Postgres { uri, .. } => {
      match crate::commands::provider::get_or_create_postgres_provider(&connection_id, uri).await {
        Ok(provider) => match provider.list_databases().await.map_err_string() {
          Ok(db_names) => ResponseModel::success(list_databases_with_pagination(db_names, offset, limit)),
          Err(e) => {
            timer.clone().finish_error(&e);
            ResponseModel::error(e)
          }
        },
        Err(e) => {
          timer.clone().finish_error(&e.to_string());
          ResponseModel::error(e.to_string())
        }
      }
    }
    ConnectionConfigEnum::MySql { uri, .. } => {
      match crate::commands::provider::get_or_create_mysql_provider(&connection_id, uri).await {
        Ok(provider) => match provider.list_databases().await.map_err_string() {
          Ok(db_names) => ResponseModel::success(list_databases_with_pagination(db_names, offset, limit)),
          Err(e) => {
            timer.clone().finish_error(&e);
            ResponseModel::error(e)
          }
        },
        Err(e) => {
          timer.clone().finish_error(&e.to_string());
          ResponseModel::error(e.to_string())
        }
      }
    }
  };

  timer.finish(&result);
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
