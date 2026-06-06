use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::types::DatabaseMeta;
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::infrastructure::nosql_orm_adapter::validate_safe_path;
use crate::infrastructure::nosql_orm_adapter::NosqlOrmAdapter;
use nosql_orm::prelude::*;

const MAX_DIRS_PER_LEVEL: usize = 10;
const MAX_FILES_PER_DIR: usize = 10_000;
const SCAN_TIMEOUT_SECS: u64 = 30;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DatabaseListResult {
  pub databases: Vec<DatabaseMeta>,
  pub has_more: bool,
  pub total_count: usize,
}

#[tauri::command]
pub async fn database_list(
  connId: String,
  offset: Option<usize>,
  limit: Option<usize>,
) -> Result<DatabaseListResult, String> {
  validate_conn_id(&connId)?;
  let entry = get_connection_entry(&connId).await?;
  let offset = offset.unwrap_or(0);
  let limit = limit.unwrap_or(MAX_DIRS_PER_LEVEL);

  match &entry.config.config {
    ConnectionConfigEnum::Json { path, .. } => {
      let path_obj = std::path::Path::new(path).to_path_buf();
      if !path_obj.is_dir() {
        return Ok(DatabaseListResult {
          databases: Vec::new(),
          has_more: false,
          total_count: 0,
        });
      }

      let result = list_json_databases(path_obj.clone(), offset, limit).await?;
      Ok(result)
    }
    ConnectionConfigEnum::Sqlite { path, .. } => {
      let db_name = std::path::Path::new(path)
        .file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("database")
        .to_string();
      Ok(DatabaseListResult {
        databases: vec![DatabaseMeta::from_name(&db_name)],
        has_more: false,
        total_count: 1,
      })
    }
    ConnectionConfigEnum::Redis { .. } => Ok(DatabaseListResult {
      databases: vec![DatabaseMeta::from_name("default")],
      has_more: false,
      total_count: 1,
    }),
    ConnectionConfigEnum::Mongo { uri, .. } => {
      let provider =
        crate::commands::provider::get_or_create_mongo_provider(&connId, uri, "admin").await?;
      let db_names = provider.list_databases().await.map_err_string()?;
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
      Ok(DatabaseListResult {
        databases: dbs,
        has_more,
        total_count,
      })
    }
    ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider =
        crate::commands::provider::get_or_create_postgres_provider(&connId, uri).await?;
      let db_names = provider.list_databases().await.map_err_string()?;
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
      Ok(DatabaseListResult {
        databases: dbs,
        has_more,
        total_count,
      })
    }
    ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::get_or_create_mysql_provider(&connId, uri).await?;
      let db_names = provider.list_databases().await.map_err_string()?;
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
      Ok(DatabaseListResult {
        databases: dbs,
        has_more,
        total_count,
      })
    }
  }
}

#[tauri::command]
pub async fn database_create(connId: String, name: String) -> Result<(), String> {
  validate_conn_id(&connId)?;
  validate_name(&name)?;
  let entry = get_connection_entry(&connId).await?;

  match &entry.config.config {
    ConnectionConfigEnum::Sqlite { path, .. } => {
      if !std::path::Path::new(path).exists() {
        tokio::fs::File::create(path).await.map_err_string()?;
      }
      Ok(())
    }
    ConnectionConfigEnum::Json { path, .. } => {
      NosqlOrmAdapter::create_database_json(path, &name).await
    }
    ConnectionConfigEnum::Redis { .. } => Ok(()),
    ConnectionConfigEnum::Mongo { uri, .. } => {
      let provider = crate::commands::provider::create_mongo_provider(uri, &name).await?;
      provider
        .execute_raw("create", vec![])
        .await
        .map_err_string()?;
      Ok(())
    }
    ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri).await?;
      provider
        .execute_raw(&format!("CREATE DATABASE \"{}\"", name), vec![])
        .await
        .map_err_string()?;
      Ok(())
    }
    ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::create_mysql_provider(uri).await?;
      provider
        .execute_raw(&format!("CREATE DATABASE IF NOT EXISTS `{}`", name), vec![])
        .await
        .map_err_string()?;
      Ok(())
    }
  }
}

#[tauri::command]
pub async fn database_rename(
  connId: String,
  oldName: String,
  newName: String,
) -> Result<(), String> {
  validate_conn_id(&connId)?;
  validate_name(&oldName)?;
  validate_name(&newName)?;
  let entry = get_connection_entry(&connId).await?;

  match &entry.config.config {
    ConnectionConfigEnum::Sqlite { .. } => Err(
      "SQLite database cannot be renamed. Create a new connection with a different file path."
        .to_string(),
    ),
    ConnectionConfigEnum::Json { path, .. } => {
      let old_path = validate_safe_path(path, &oldName)?;
      let new_path = validate_safe_path(path, &newName)?;
      if old_path.exists() {
        tokio::fs::rename(&old_path, &new_path)
          .await
          .map_err_string()?;
      }
      Ok(())
    }
    ConnectionConfigEnum::Redis { .. } => {
      Err("Redis does not support renaming databases.".to_string())
    }
    ConnectionConfigEnum::Mongo { uri: _, .. } => {
      Err("MongoDB does not support renaming databases via this interface.".to_string())
    }
    ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri).await?;
      provider
        .execute_raw(
          &format!("ALTER DATABASE \"{}\" RENAME TO \"{}\"", oldName, newName),
          vec![],
        )
        .await
        .map_err_string()?;
      Ok(())
    }
    ConnectionConfigEnum::MySql { uri: _, .. } => Err(
      "MySQL does not support renaming databases directly. Create a new database and migrate data."
        .to_string(),
    ),
  }
}

#[tauri::command]
pub async fn database_delete(connId: String, name: String) -> Result<(), String> {
  validate_conn_id(&connId)?;
  validate_name(&name)?;
  let entry = get_connection_entry(&connId).await?;

  match &entry.config.config {
    ConnectionConfigEnum::Sqlite { .. } => Err(
      "SQLite database cannot be deleted. Delete the connection and remove the file.".to_string(),
    ),
    ConnectionConfigEnum::Json { path, .. } => {
      NosqlOrmAdapter::drop_database_json(path, &name).await
    }
    ConnectionConfigEnum::Redis { .. } => {
      Err("Redis does not support deleting databases.".to_string())
    }
    ConnectionConfigEnum::Mongo { .. } => {
      Err("MongoDB database deletion is not supported via this interface.".to_string())
    }
    ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri).await?;
      provider
        .execute_raw(&format!("DROP DATABASE \"{}\"", name), vec![])
        .await
        .map_err_string()?;
      Ok(())
    }
    ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::create_mysql_provider(uri).await?;
      provider
        .execute_raw(&format!("DROP DATABASE IF EXISTS `{}`", name), vec![])
        .await
        .map_err_string()?;
      Ok(())
    }
  }
}

async fn list_json_databases(
  path_obj: std::path::PathBuf,
  offset: usize,
  limit: usize,
) -> Result<DatabaseListResult, String> {
  let folder_name = path_obj
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or("database")
    .to_string();

  let timeout_result =
    tokio::time::timeout(std::time::Duration::from_secs(SCAN_TIMEOUT_SECS), async {
      let mut entries = tokio::fs::read_dir(&path_obj).await.map_err_string()?;
      let mut all_databases: Vec<DatabaseMeta> = Vec::new();
      let mut has_root_json = false;

      while let Some(entry) = entries.next_entry().await.map_err_string()? {
        let entry_path = entry.path();
        if entry_path.is_dir() {
          if all_databases.len() < MAX_DIRS_PER_LEVEL * 2 || all_databases.len() < 100 {
            let name = entry.file_name().into_string().unwrap_or_default();
            let collection_count = count_json_files_in_dir(&entry_path).await;
            all_databases.push(DatabaseMeta {
              name,
              size_bytes: None,
              table_count: Some(collection_count),
            });
          }
        } else if entry_path.extension().is_some_and(|ext| ext == "json") {
          has_root_json = true;
        }
      }

      if has_root_json {
        all_databases.insert(
          0,
          DatabaseMeta {
            name: folder_name.clone(),
            size_bytes: None,
            table_count: None,
          },
        );
      }

      all_databases.sort_by(|a, b| a.name.cmp(&b.name));
      let total_count = all_databases.len();
      let has_more = offset + limit < total_count;
      let databases = all_databases.into_iter().skip(offset).take(limit).collect();

      Ok(DatabaseListResult {
        databases,
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

async fn count_json_files_in_dir(path: &std::path::Path) -> u64 {
  let timeout_result =
    tokio::time::timeout(std::time::Duration::from_secs(SCAN_TIMEOUT_SECS), async {
      let mut entries = match tokio::fs::read_dir(path).await {
        Ok(e) => e,
        Err(_) => return 0u64,
      };

      let mut count = 0u64;
      while let Ok(Some(entry)) = entries.next_entry().await {
        if count >= MAX_FILES_PER_DIR as u64 {
          break;
        }
        if entry.path().extension().is_some_and(|ext| ext == "json") {
          count += 1;
        }
      }
      count
    })
    .await;

  match timeout_result {
    Ok(c) => c,
    Err(_) => 0,
  }
}
