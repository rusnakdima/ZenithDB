use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_auth_context;
use crate::commands::get_connection_entry;
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::dispatch_provider;
use crate::infrastructure::nosql_orm_adapter::NosqlOrmAdapter;
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

fn validate_safe_path(base: &str, user_input: &str) -> Result<PathBuf, String> {
  crate::infrastructure::nosql_orm_adapter::validate_safe_path(base, user_input)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionMeta {
  pub name: String,
  pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
  pub name: String,
  pub data_type: String,
  pub nullable: bool,
  pub is_primary_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexInfo {
  pub name: String,
  pub columns: Vec<String>,
  pub is_unique: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionSchema {
  pub name: String,
  pub columns: Vec<ColumnInfo>,
  pub indexes: Vec<IndexInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionStats {
  pub name: String,
  pub document_count: u64,
  pub size_bytes: u64,
  pub index_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
pub async fn list_databases(conn_id: &str) -> Result<Vec<DatabaseMeta>, String> {
  validate_conn_id(conn_id)?;
  let entry = get_connection_entry(conn_id).await?;

  match &entry.config.config {
    ConnectionConfigEnum::Json { path, behavior, .. } => {
      let provider = NosqlOrmAdapter::create_provider(&entry.config.config).await?;
      let databases = provider.list_databases().await?;
      match behavior.as_str() {
        "files_as_collections" => Ok(databases),
        "folders_as_databases" | "mixed" => {
          if databases.is_empty() {
            let path_obj = std::path::Path::new(path).to_path_buf();
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
        _ => Ok(databases),
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
pub async fn create_database(conn_id: &str, name: &str) -> Result<(), String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(conn_id) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(conn_id)?;
  validate_name(name)?;
  let entry = get_connection_entry(conn_id).await?;

  match &entry.config.config {
    ConnectionConfigEnum::Sqlite { path, .. } => {
      if !std::path::Path::new(path).exists() {
        tokio::fs::File::create(path).await.map_err_string()?;
      }
      Ok(())
    }
    ConnectionConfigEnum::Json { path, .. } => {
      NosqlOrmAdapter::create_database_json(path, name).await
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
pub async fn rename_database(conn_id: &str, old_name: &str, new_name: &str) -> Result<(), String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(conn_id) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(conn_id)?;
  validate_name(old_name)?;
  validate_name(new_name)?;
  let entry = get_connection_entry(conn_id).await?;

  match &entry.config.config {
    ConnectionConfigEnum::Sqlite { .. } => Err(
      "SQLite database cannot be renamed. Create a new connection with a different file path."
        .to_string(),
    ),
    ConnectionConfigEnum::Json { path, .. } => {
      let old_path = validate_safe_path(path, old_name)?;
      let new_path = validate_safe_path(path, new_name)?;
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
pub async fn delete_database(conn_id: &str, name: &str) -> Result<(), String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(conn_id) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(conn_id)?;
  validate_name(name)?;
  let entry = get_connection_entry(conn_id).await?;

  match &entry.config.config {
    ConnectionConfigEnum::Sqlite { .. } => Err(
      "SQLite database cannot be deleted. Delete the connection and remove the file.".to_string(),
    ),
    ConnectionConfigEnum::Json { path, .. } => {
      NosqlOrmAdapter::drop_database_json(path, name).await
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

#[tauri::command]
pub async fn list_collections(
  conn_id: &str,
  db_name: Option<String>,
) -> Result<Vec<CollectionMeta>, String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(conn_id) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(conn_id)?;
  tracing::debug!("list_collections started for connection: {}", conn_id);
  let entry = get_connection_entry(conn_id).await?;
  tracing::debug!("list_collections got connection entry for: {}", conn_id);

  tokio::time::timeout(std::time::Duration::from_secs(10), async {
    match &entry.config.config {
      ConnectionConfigEnum::Json { path, behavior, .. } => {
        let path_obj = std::path::Path::new(path).to_path_buf();
        if !path_obj.is_dir() {
          return Ok(Vec::new());
        }

        match behavior.as_str() {
          "files_as_collections" => {
            let collections = list_json_collections(path_obj).await?;
            Ok(collections)
          }
          "folders_as_databases" => {
            if let Some(db) = db_name {
              let folder_name = path_obj.file_name().and_then(|n| n.to_str()).unwrap_or("");

              let collections = if db == folder_name {
                list_json_collections(path_obj).await?
              } else {
                let db_path = path_obj.join(&db);
                list_json_collections(db_path).await?
              };
              Ok(collections)
            } else {
              let all_collections = list_all_json_collections_recursive(path_obj).await?;
              Ok(all_collections)
            }
          }
          "mixed" => {
            if let Some(db) = db_name {
              if db == "root" {
                let collections = list_json_collections(path_obj).await?;
                Ok(collections)
              } else {
                let db_path = path_obj.join(&db);
                let collections = list_json_collections(db_path).await?;
                Ok(collections)
              }
            } else {
              let collections = list_json_collections(path_obj).await?;
              Ok(collections)
            }
          }
          _ => {
            let collections = list_json_collections(path_obj).await?;
            Ok(collections)
          }
        }
      }
      _ => {
        tracing::debug!("list_collections dispatching provider for: {}", conn_id);
        dispatch_provider!(entry, provider => {
            tracing::debug!("list_collections provider dispatched, calling list_collections on provider");
            let collections = provider.list_collections().await.map_err_string()?;
            tracing::debug!("list_collections got {} collections", collections.len());
            Ok(collections
                .into_iter()
                .map(|c| CollectionMeta {
                    name: c.name,
                    count: c.document_count,
                })
                .collect())
        })
      }
    }
  })
  .await
  .map_err(|_| {
    tracing::error!("list_collections timed out for connection: {}", conn_id);
    "List collections timed out".to_string()
  })?
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

async fn list_all_json_collections_recursive(
  path_obj: std::path::PathBuf,
) -> Result<Vec<CollectionMeta>, String> {
  let mut collections: Vec<CollectionMeta> = Vec::new();
  let mut dirs_to_scan: Vec<std::path::PathBuf> = vec![path_obj];

  while let Some(current_dir) = dirs_to_scan.pop() {
    let mut entries = match tokio::fs::read_dir(&current_dir).await {
      Ok(e) => e,
      Err(_) => continue,
    };

    while let Some(entry) = entries.next_entry().await.map_err_string()? {
      let entry_path = entry.path();

      if entry_path.is_dir() {
        dirs_to_scan.push(entry_path);
      } else if entry_path.extension().is_some_and(|ext| ext == "json") {
        let name = entry
          .file_name()
          .into_string()
          .ok()
          .map(|n| n.trim_end_matches(".json").to_string());

        if let Some(name) = name {
          let count = match tokio::fs::read_to_string(&entry_path).await {
            Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
              Ok(v) => {
                if let Some(arr) = v.as_array() {
                  arr.len() as u64
                } else {
                  1
                }
              }
              Err(_) => 0,
            },
            Err(_) => 0,
          };

          collections.push(CollectionMeta { name, count });
        }
      }
    }
  }

  Ok(collections)
}

async fn list_json_collections(
  path_obj: std::path::PathBuf,
) -> Result<Vec<CollectionMeta>, String> {
  let mut collections: Vec<CollectionMeta> = Vec::new();
  let mut dirs_to_scan: Vec<(std::path::PathBuf, String)> = vec![(path_obj, String::new())];

  while let Some((current_dir, base_path)) = dirs_to_scan.pop() {
    let mut entries = match tokio::fs::read_dir(&current_dir).await {
      Ok(e) => e,
      Err(_) => continue,
    };

    while let Some(entry) = entries.next_entry().await.map_err_string()? {
      let entry_path = entry.path();

      if entry_path.is_dir() {
        let folder_name = entry.file_name().into_string().unwrap_or_default();
        let new_base = if base_path.is_empty() {
          folder_name.clone()
        } else {
          format!("{}/{}", base_path, folder_name)
        };
        dirs_to_scan.push((entry_path, new_base));
      } else if entry_path.extension().is_some_and(|ext| ext == "json") {
        let file_name = entry
          .file_name()
          .into_string()
          .ok()
          .map(|n| n.trim_end_matches(".json").to_string());

        if let Some(file_name) = file_name {
          let name = if base_path.is_empty() {
            file_name.clone()
          } else {
            format!("{}/{}", base_path, file_name)
          };

          let count = match tokio::fs::read_to_string(&entry_path).await {
            Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
              Ok(v) => {
                if let Some(arr) = v.as_array() {
                  arr.len() as u64
                } else {
                  1
                }
              }
              Err(_) => 0,
            },
            Err(_) => 0,
          };

          collections.push(CollectionMeta { name, count });
        }
      }
    }
  }

  Ok(collections)
}

#[tauri::command]
pub async fn describe_collection(
  conn_id: &str,
  collection: &str,
) -> Result<CollectionSchema, String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(conn_id) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(conn_id)?;
  validate_name(collection)?;
  let entry = get_connection_entry(conn_id).await?;

  let (schema, indexes) = dispatch_provider!(entry, provider => {
      let schema = provider.describe_collection(collection).await.map_err_string()?;
      let indexes = nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, collection)
          .await
          .map_err_string()?;
      Ok::<_, String>((schema, indexes))
  })?;

  let columns: Vec<ColumnInfo> = schema
    .fields
    .iter()
    .map(|(name, field)| ColumnInfo {
      name: name.clone(),
      data_type: field.field_type.clone(),
      nullable: field.nullable,
      is_primary_key: false,
    })
    .collect();

  let index_infos: Vec<IndexInfo> = indexes
    .into_iter()
    .map(|idx| IndexInfo {
      name: idx.name,
      columns: idx.fields,
      is_unique: idx.unique,
    })
    .collect();

  Ok(CollectionSchema {
    name: collection.to_string(),
    columns,
    indexes: index_infos,
  })
}

#[tauri::command]
pub async fn get_collection_stats(
  conn_id: &str,
  collection: &str,
) -> Result<CollectionStats, String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(conn_id) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(conn_id)?;
  validate_name(collection)?;
  let entry = get_connection_entry(conn_id).await?;

  let stats = dispatch_provider!(entry, provider => {
      provider.get_collection_stats(collection).await.map_err_string()
  })?;

  Ok(CollectionStats {
    name: collection.to_string(),
    document_count: stats.document_count,
    size_bytes: stats.size_bytes,
    index_count: stats.index_count,
  })
}

#[tauri::command]
pub async fn list_databases_for_uri(
  provider_type: &str,
  uri: &str,
) -> Result<Vec<DatabaseMeta>, String> {
  if uri.is_empty() {
    return Err("URI cannot be empty".to_string());
  }
  validate_name(provider_type)?;

  match provider_type {
    "postgres" => {
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
    "mysql" => {
      let provider = crate::commands::provider::create_mysql_provider(uri).await?;
      let result = provider
        .execute_raw("SHOW DATABASES", vec![])
        .await
        .map_err_string()?;
      Ok(parse_database_rows(&result.rows))
    }
    "mongodb" => {
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
    "redis" => {
      let provider = crate::commands::provider::create_redis_provider(uri).await?;
      let result = provider
        .execute_raw("INFO keyspace", vec![])
        .await
        .map_err_string()?;
      let mut dbs = Vec::new();
      for row in result.rows {
        if let Some(line) = row.first().and_then(|v| v.as_str()) {
          for part in line.lines() {
            if part.starts_with("db") {
              if let Some(name) = part.split(',').next().and_then(|s| s.split('=').last()) {
                dbs.push(DatabaseMeta {
                  name: name.to_string(),
                  size_bytes: None,
                  table_count: None,
                });
              }
            }
          }
        }
      }
      if dbs.is_empty() {
        dbs.push(DatabaseMeta {
          name: "default".to_string(),
          size_bytes: None,
          table_count: None,
        });
      }
      Ok(dbs)
    }
    _ => Ok(vec![DatabaseMeta {
      name: "default".to_string(),
      size_bytes: None,
      table_count: None,
    }]),
  }
}
