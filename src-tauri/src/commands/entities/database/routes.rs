use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::infrastructure::nosql_orm_adapter::validate_safe_path;
use crate::infrastructure::nosql_orm_adapter::NosqlOrmAdapter;
use nosql_orm::prelude::*;

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
pub async fn database_list(conn_id: String) -> Result<Vec<DatabaseMeta>, String> {
  validate_conn_id(&conn_id)?;
  let entry = get_connection_entry(&conn_id).await?;

  match &entry.config.config {
    ConnectionConfigEnum::Json { path, behavior, .. } => {
      let path_obj = std::path::Path::new(path).to_path_buf();
      if !path_obj.is_dir() {
        return Ok(Vec::new());
      }

      match behavior.as_str() {
        "files_as_collections" => {
          let folder_name = path_obj
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("root")
            .to_string();
          let count = count_json_files_in_dir(&path_obj).await;
          Ok(vec![DatabaseMeta {
            name: folder_name,
            size_bytes: None,
            table_count: Some(count),
          }])
        }
        "folders_as_databases" | "mixed" => {
          let databases = list_json_databases(path_obj.clone(), behavior.as_str()).await?;
          if databases.is_empty() {
            let folder_name = path_obj
              .file_name()
              .and_then(|n| n.to_str())
              .unwrap_or("root")
              .to_string();
            let count = count_json_files_in_dir(&path_obj).await;
            Ok(vec![DatabaseMeta {
              name: folder_name,
              size_bytes: None,
              table_count: Some(count),
            }])
          } else {
            Ok(databases)
          }
        }
        _ => {
          let databases = list_json_databases(path_obj.clone(), "folders_as_databases").await?;
          Ok(databases)
        }
      }
    }
    ConnectionConfigEnum::Sqlite { .. } => Ok(vec![DatabaseMeta::from_name("default")]),
    ConnectionConfigEnum::Redis { .. } => Ok(vec![DatabaseMeta::from_name("default")]),
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
      Ok(dbs)
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
      Ok(parse_database_rows(&result.rows))
    }
    ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::create_mysql_provider(uri).await?;
      let result = provider
        .execute_raw("SHOW DATABASES", vec![])
        .await
        .map_err_string()?;
      Ok(parse_database_rows(&result.rows))
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
  behavior: &str,
) -> Result<Vec<DatabaseMeta>, String> {
  let mut entries = tokio::fs::read_dir(&path_obj).await.map_err_string()?;
  let mut databases: Vec<DatabaseMeta> = Vec::new();

  while let Some(entry) = entries.next_entry().await.map_err_string()? {
    let entry_path = entry.path();
    if entry_path.is_dir() {
      let name = entry.file_name().into_string().unwrap_or_default();

      let collection_count = count_json_files_in_dir(&entry_path).await;

      databases.push(DatabaseMeta {
        name,
        size_bytes: None,
        table_count: Some(collection_count),
      });
    } else if behavior == "mixed" && entry_path.extension().is_some_and(|ext| ext == "json") {
      let has_root = databases.iter().any(|d| d.name == "root");
      if !has_root {
        databases.insert(
          0,
          DatabaseMeta {
            name: "root".to_string(),
            size_bytes: None,
            table_count: None,
          },
        );
      }
    }
  }

  if behavior == "mixed" {
    if !databases.iter().any(|d| d.name == "root") {
      let root_count = count_json_files_in_dir(&path_obj).await;
      databases.push(DatabaseMeta {
        name: "root".to_string(),
        size_bytes: None,
        table_count: Some(root_count),
      });
    }
  }

  databases.sort_by(|a, b| a.name.cmp(&b.name));
  Ok(databases)
}

async fn count_json_files_in_dir(path: &std::path::Path) -> u64 {
  let mut entries = match tokio::fs::read_dir(path).await {
    Ok(e) => e,
    Err(_) => return 0,
  };

  let mut count = 0u64;
  while let Ok(Some(entry)) = entries.next_entry().await {
    if entry.path().extension().is_some_and(|ext| ext == "json") {
      count += 1;
    }
  }
  count
}
