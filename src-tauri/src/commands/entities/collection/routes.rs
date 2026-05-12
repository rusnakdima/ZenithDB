use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
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

#[tauri::command]
pub async fn collection_list(
  conn_id: String,
  db_name: Option<String>,
) -> Result<Vec<CollectionMeta>, String> {
  validate_conn_id(&conn_id)?;
  let entry = get_connection_entry(&conn_id).await?;

  match &entry.config.config {
    crate::commands::connection::ConnectionConfigEnum::Json { path, behavior, .. } => {
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

#[tauri::command]
pub async fn collection_describe(
  conn_id: String,
  name: String,
) -> Result<CollectionSchema, String> {
  validate_conn_id(&conn_id)?;
  validate_name(&name)?;
  let entry = get_connection_entry(&conn_id).await?;

  let (schema, indexes) = dispatch_provider!(entry, provider => {
      let schema = provider.describe_collection(&name).await.map_err_string()?;
      let indexes = nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, &name)
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
    name,
    columns,
    indexes: index_infos,
  })
}

#[tauri::command]
pub async fn collection_stats(conn_id: String, name: String) -> Result<CollectionStats, String> {
  validate_conn_id(&conn_id)?;
  validate_name(&name)?;
  let entry = get_connection_entry(&conn_id).await?;

  let stats = dispatch_provider!(entry, provider => {
      provider.get_collection_stats(&name).await.map_err_string()
  })?;

  Ok(CollectionStats {
    name,
    document_count: stats.document_count,
    size_bytes: stats.size_bytes,
    index_count: stats.index_count,
  })
}

#[tauri::command]
pub async fn collection_create(conn_id: String, name: String) -> Result<(), String> {
  validate_conn_id(&conn_id)?;
  validate_name(&name)?;
  let entry = get_connection_entry(&conn_id).await?;
  dispatch_provider!(entry, provider => {
      provider.create_collection(&name, None).await.map_err_string()
  })
}

#[tauri::command]
pub async fn collection_drop(conn_id: String, name: String) -> Result<(), String> {
  validate_conn_id(&conn_id)?;
  validate_name(&name)?;
  let entry = get_connection_entry(&conn_id).await?;
  dispatch_provider!(entry, provider => {
      provider.drop_collection(&name).await.map_err_string()
  })
}

#[tauri::command]
pub async fn collection_rename(
  conn_id: String,
  old_name: String,
  new_name: String,
) -> Result<(), String> {
  validate_conn_id(&conn_id)?;
  validate_name(&old_name)?;
  validate_name(&new_name)?;
  let entry = get_connection_entry(&conn_id).await?;
  dispatch_provider!(entry, provider => {
      let data = provider.find_many(&old_name, None, None, None, None, true).await.map_err_string()?;
      for item in data {
          provider.insert(&new_name, item.clone()).await.map_err_string()?;
      }
      provider.drop_collection(&old_name).await.map_err_string()
  })
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
