use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DatabaseMeta {
  pub name: String,
  pub size_bytes: Option<u64>,
  pub table_count: Option<u64>,
}

impl DatabaseMeta {
  fn from_name(name: &str) -> Self {
    Self {
      name: name.to_string(),
      size_bytes: None,
      table_count: None,
    }
  }
}

fn parse_database_rows(rows: &[Vec<serde_json::Value>]) -> Vec<DatabaseMeta> {
  let mut dbs = Vec::new();
  for row in rows {
    if let Some(name) = row.first().and_then(|v| v.as_str()) {
      dbs.push(DatabaseMeta::from_name(name));
    }
  }
  dbs
}

#[tauri::command]
pub async fn database_list(
  conn_id: String,
  offset: Option<usize>,
  limit: Option<usize>,
) -> Result<DatabaseListResult, String> {
  validate_conn_id(&conn_id)?;
  let entry = get_connection_entry(&conn_id).await?;
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
      let provider = crate::commands::provider::create_mongo_provider(uri, "admin").await?;
      let result = provider
        .execute_raw("listDatabases", vec![])
        .await
        .map_err_string()?;
      let mut dbs = Vec::new();
      for row in result.rows {
        if let Some(doc) = row.get(0).and_then(|v| v.as_object()) {
          if let Some(name) = doc.get("name").and_then(|v| v.as_str()) {
            dbs.push(DatabaseMeta {
              name: name.to_string(),
              size_bytes: None,
              table_count: None,
            });
          }
        }
      }
      let total_count = dbs.len();
      let has_more = offset + dbs.len() < total_count;
      let dbs = dbs.into_iter().skip(offset).take(limit).collect();
      Ok(DatabaseListResult {
        databases: dbs,
        has_more,
        total_count,
      })
    }
    ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri).await?;
      let result = provider
        .execute_raw(
          "SELECT datname FROM pg_database WHERE datistemplate = false",
          vec![],
        )
        .await
        .map_err_string()?;
      let all_dbs = parse_database_rows(&result.rows);
      let total_count = all_dbs.len();
      let has_more = offset + limit < total_count;
      let dbs = all_dbs.into_iter().skip(offset).take(limit).collect();
      Ok(DatabaseListResult {
        databases: dbs,
        has_more,
        total_count,
      })
    }
    ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::create_mysql_provider(uri).await?;
      let result = provider
        .execute_raw("SHOW DATABASES", vec![])
        .await
        .map_err_string()?;
      let all_dbs = parse_database_rows(&result.rows);
      let total_count = all_dbs.len();
      let has_more = offset + limit < total_count;
      let dbs = all_dbs.into_iter().skip(offset).take(limit).collect();
      Ok(DatabaseListResult {
        databases: dbs,
        has_more,
        total_count,
      })
    }
  }
}

#[tauri::command]
pub async fn database_create(conn_id: String, name: String) -> Result<(), String> {
  validate_conn_id(&conn_id)?;
  validate_name(&name)?;
  let entry = get_connection_entry(&conn_id).await?;

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
  conn_id: String,
  old_name: String,
  new_name: String,
) -> Result<(), String> {
  validate_conn_id(&conn_id)?;
  validate_name(&old_name)?;
  validate_name(&new_name)?;
  let entry = get_connection_entry(&conn_id).await?;

  match &entry.config.config {
    ConnectionConfigEnum::Sqlite { .. } => Err(
      "SQLite database cannot be renamed. Create a new connection with a different file path."
        .to_string(),
    ),
    ConnectionConfigEnum::Json { path, .. } => {
      let old_path = validate_safe_path(path, &old_name)?;
      let new_path = validate_safe_path(path, &new_name)?;
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
          &format!("ALTER DATABASE \"{}\" RENAME TO \"{}\"", old_name, new_name),
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
pub async fn database_delete(conn_id: String, name: String) -> Result<(), String> {
  validate_conn_id(&conn_id)?;
  validate_name(&name)?;
  let entry = get_connection_entry(&conn_id).await?;

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
