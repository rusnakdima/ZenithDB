use crate::commands::cancellation::{register_query, unregister_query, with_cancellation};
use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::metrics::record_query;
use crate::commands::rate_limit::check_rate_limit;
use crate::dispatch_provider;
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time;

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

fn validate_db_name(db_name: &str) -> Result<(), String> {
  if db_name.contains("..") {
    return Err("Database name cannot contain '..'".to_string());
  }
  if db_name.starts_with('/') || db_name.starts_with('\\') {
    return Err("Database name cannot be an absolute path".to_string());
  }
  if db_name.contains('/') && db_name.contains('\\') {
    return Err("Database name cannot contain both '/' and '\\'".to_string());
  }
  Ok(())
}

fn is_safe_path(base: &std::path::Path, target: &std::path::Path) -> bool {
  if let Ok(base_canonical) = base.canonicalize() {
    if let Ok(target_canonical) = target.canonicalize() {
      return target_canonical.starts_with(&base_canonical);
    }
  }
  false
}

#[tauri::command]
pub async fn list_databases(conn_id: &str) -> Result<Vec<DatabaseMeta>, String> {
  check_rate_limit(conn_id).await?;
  let entry = get_connection_entry(conn_id).await?;

  record_query(async {
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
        let provider = crate::commands::provider::create_mongo_provider(uri).await?;
        let names = provider.list_databases().await.map_err_string()?;
        provider.close().await.map_err_string()?;
        Ok(
          names
            .into_iter()
            .map(|name| DatabaseMeta {
              name,
              size_bytes: None,
              table_count: None,
            })
            .collect(),
        )
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
  })
  .await
}

#[tauri::command]
pub async fn list_collections(
  conn_id: &str,
  db_name: Option<String>,
) -> Result<Vec<CollectionMeta>, String> {
  check_rate_limit(conn_id).await?;
  let entry = get_connection_entry(conn_id).await?;

  let (query_id, token) = register_query().await?;

  let result = with_cancellation(&query_id, token, async {
    record_query(async {
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
                validate_db_name(&db)?;
                let folder_name = path_obj.file_name().and_then(|n| n.to_str()).unwrap_or("");

                let collections = if db == folder_name {
                  list_json_collections(path_obj).await?
                } else {
                  let db_path = path_obj.join(&db);
                  if !is_safe_path(&path_obj, &db_path) {
                    return Err("Invalid database path".to_string());
                  }
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
                  validate_db_name(&db)?;
                  let db_path = path_obj.join(&db);
                  if !is_safe_path(&path_obj, &db_path) {
                    return Err("Invalid database path".to_string());
                  }
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
        ConnectionConfigEnum::Mongo { uri, .. } => {
          let provider = crate::commands::provider::create_mongo_provider(uri).await?;
          let collections = provider.list_collections().await.map_err_string()?;
          provider.close().await.map_err_string()?;
          Ok(
            collections
              .into_iter()
              .map(|c| CollectionMeta {
                name: c.name,
                count: c.document_count,
              })
              .collect(),
          )
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
    })
    .await
  })
  .await;

  unregister_query(&query_id).await;
  result
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
      let name = entry.file_name().into_string().map_err_string()?;

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

  if behavior == "mixed" && !databases.iter().any(|d| d.name == "root") {
    let root_count = count_json_files_in_dir(&path_obj).await;
    databases.push(DatabaseMeta {
      name: "root".to_string(),
      size_bytes: None,
      table_count: Some(root_count),
    });
  }

  databases.sort_by(|a, b| a.name.cmp(&b.name));
  Ok(databases)
}

async fn count_json_files_in_dir(path: &std::path::Path) -> u64 {
  let fut = async {
    let mut entries = match tokio::fs::read_dir(path).await {
      Ok(e) => e,
      Err(e) => {
        eprintln!("Failed to read directory {}: {}", path.display(), e);
        return 0;
      }
    };

    let mut count = 0u64;
    while let Ok(Some(entry)) = entries.next_entry().await {
      if entry.path().extension().is_some_and(|ext| ext == "json") {
        count += 1;
      }
    }
    count
  };

  time::timeout(Duration::from_secs(30), fut)
    .await
    .unwrap_or(0)
}

async fn list_all_json_collections_recursive(
  path_obj: std::path::PathBuf,
) -> Result<Vec<CollectionMeta>, String> {
  let mut collections: Vec<CollectionMeta> = Vec::new();
  let mut dirs_to_scan: Vec<(std::path::PathBuf, usize)> = vec![(path_obj, 0)];
  let max_depth = 10;

  while let Some((current_dir, depth)) = dirs_to_scan.pop() {
    if depth >= max_depth {
      tracing::warn!(
        "Max depth {} reached, skipping: {}",
        max_depth,
        current_dir.display()
      );
      continue;
    }

    let read_dir_fut = tokio::fs::read_dir(&current_dir);
    let mut entries = match time::timeout(Duration::from_secs(30), read_dir_fut).await {
      Ok(Ok(e)) => e,
      Ok(Err(e)) | Err(_) => {
        tracing::warn!("Failed to read directory {}: {}", current_dir.display(), e);
        continue;
      }
    };

    while let Some(entry) = entries.next_entry().await.map_err_string()? {
      let entry_path = entry.path();

      if entry_path.is_dir() {
        dirs_to_scan.push((entry_path, depth + 1));
      } else if entry_path.extension().is_some_and(|ext| ext == "json") {
        let name = entry
          .file_name()
          .into_string()
          .map_err_string()
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

#[tauri::command]
pub async fn describe_collection(
  conn_id: &str,
  collection: &str,
) -> Result<CollectionSchema, String> {
  check_rate_limit(conn_id).await?;
  let entry = get_connection_entry(conn_id).await?;

  record_query(async {
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
  })
  .await
}

#[tauri::command]
pub async fn get_collection_stats(
  conn_id: &str,
  collection: &str,
) -> Result<CollectionStats, String> {
  check_rate_limit(conn_id).await?;
  let entry = get_connection_entry(conn_id).await?;

  record_query(async {
    let stats = dispatch_provider!(entry, provider => {
        provider.get_collection_stats(collection).await.map_err_string()
    })?;

    Ok(CollectionStats {
      name: collection.to_string(),
      document_count: stats.document_count,
      size_bytes: stats.size_bytes,
      index_count: stats.index_count,
    })
  })
  .await
}

#[tauri::command]
pub async fn list_databases_for_uri(
  provider_type: &str,
  uri: &str,
) -> Result<Vec<DatabaseMeta>, String> {
  if uri.is_empty() {
    return Err("URI cannot be empty".to_string());
  }

  let uri_pattern = regex::Regex::new(r"^(postgres|mysql|mongodb|redis)://.*").map_err_string()?;
  if !uri_pattern.is_match(uri) {
    return Err(
      "Invalid URI format. Must be a valid connection URI (e.g., postgres://host:port/db)"
        .to_string(),
    );
  }

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
      let provider = crate::commands::provider::create_mongo_provider(uri).await?;
      let names = provider.list_databases().await.map_err_string()?;
      Ok(
        names
          .into_iter()
          .map(|name| DatabaseMeta {
            name,
            size_bytes: None,
            table_count: None,
          })
          .collect(),
      )
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
              if let Some(name) = part
                .split(',')
                .next()
                .and_then(|s| s.split('=').next_back())
              {
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
