use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::dispatch_provider;
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};

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
  let entry = get_connection_entry(conn_id).await?;

  match &entry.config.config {
    ConnectionConfigEnum::Json { path, behavior, .. } => {
      let path_obj = std::path::Path::new(path).to_path_buf();
      if !path_obj.is_dir() {
        return Ok(Vec::new());
      }

      match behavior.as_str() {
        "files_as_collections" => Ok(vec![DatabaseMeta {
          name: "root".to_string(),
          size_bytes: None,
          table_count: None,
        }]),
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
    ConnectionConfigEnum::Mongo { .. } => Ok(vec![]),
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
  let entry = get_connection_entry(conn_id).await?;

  match &entry.config.config {
        ConnectionConfigEnum::Sqlite { .. } => {
            Err("SQLite does not support creating databases. Create a new connection with a different file path.".to_string())
        }
        ConnectionConfigEnum::Json { .. } => {
            Err("JSON provider does not support creating databases.".to_string())
        }
        ConnectionConfigEnum::Redis { .. } => {
            Err("Redis does not support creating databases.".to_string())
        }
        ConnectionConfigEnum::Mongo { .. } => {
            Err("Creating databases is not supported via this interface. Connect to the MongoDB server and use the mongo shell to create databases.".to_string())
        }
        ConnectionConfigEnum::Postgres { uri, .. } => {
            let provider = crate::commands::provider::create_postgres_provider(uri).await?;
            provider.execute_raw(&format!("CREATE DATABASE \"{}\"", name), vec![]).await.map_err_string()?;
            Ok(())
        }
        ConnectionConfigEnum::MySql { uri, .. } => {
            let provider = crate::commands::provider::create_mysql_provider(uri).await?;
            provider.execute_raw(&format!("CREATE DATABASE IF NOT EXISTS `{}`", name), vec![]).await.map_err_string()?;
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn list_collections(
  conn_id: &str,
  db_name: Option<String>,
) -> Result<Vec<CollectionMeta>, String> {
  let entry = get_connection_entry(conn_id).await?;

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
      dispatch_provider!(entry, provider => {
          let collections = provider.list_collections().await.map_err_string()?;
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
  let mut entries = tokio::fs::read_dir(&path_obj).await.map_err_string()?;

  let mut collections: Vec<CollectionMeta> = Vec::new();

  while let Some(entry) = entries.next_entry().await.map_err_string()? {
    let file_path = entry.path();
    if file_path.extension().is_some_and(|ext| ext == "json") {
      let name = entry
        .file_name()
        .into_string()
        .ok()
        .map(|n| n.trim_end_matches(".json").to_string());

      if let Some(name) = name {
        let count = match tokio::fs::read_to_string(&file_path).await {
          Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
            Ok(v) => {
              if let Some(arr) = v.as_array() {
                arr.len() as u64
              } else {
                1
              }
            }
            Err(e) => {
              eprintln!("Warning: Failed to parse {}: {}", file_path.display(), e);
              0
            }
          },
          Err(e) => {
            eprintln!("Warning: Failed to read {}: {}", file_path.display(), e);
            0
          }
        };

        collections.push(CollectionMeta { name, count });
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
    "redis" => Ok(vec![DatabaseMeta {
      name: "default".to_string(),
      size_bytes: None,
      table_count: None,
    }]),
    _ => Ok(vec![DatabaseMeta {
      name: "default".to_string(),
      size_bytes: None,
      table_count: None,
    }]),
  }
}
