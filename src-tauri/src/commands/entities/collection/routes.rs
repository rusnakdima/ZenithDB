use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::dispatch_provider;
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};

const MAX_FILES_PER_DIR: usize = 10_000;
const MAX_COLLECTIONS_TOTAL: usize = 50_000;
const MAX_DEPTH: usize = 5;
const SCAN_TIMEOUT_SECS: u64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionListResult {
  pub collections: Vec<CollectionMeta>,
  pub has_more: bool,
  pub total_count: usize,
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

#[tauri::command]
pub async fn collection_list(
  connId: String,
  dbName: Option<String>,
  offset: Option<usize>,
  limit: Option<usize>,
) -> Result<CollectionListResult, String> {
  validate_conn_id(&connId)?;
  let entry = get_connection_entry(&connId).await?;
  let offset = offset.unwrap_or(0);
  let limit = limit.unwrap_or(10);

  match &entry.config.config {
    crate::commands::connection::ConnectionConfigEnum::Json { path, .. } => {
      let path_obj = std::path::Path::new(path).to_path_buf();
      if !path_obj.is_dir() {
        return Ok(CollectionListResult {
          collections: Vec::new(),
          has_more: false,
          total_count: 0,
        });
      }

      let result = list_all_json_collections_recursive(path_obj, offset, limit).await?;
      Ok(result)
    }
    _ => {
      dispatch_provider!(entry, provider => {
          let all_collections = provider.list_collections().await.map_err_string()?;
          let total_count = all_collections.len();
          let collections: Vec<CollectionMeta> = all_collections
              .into_iter()
              .skip(offset)
              .take(limit)
              .map(|c| CollectionMeta {
                  name: c.name,
                  count: c.document_count,
              })
              .collect();
          let has_more = offset + limit < total_count;
          Ok(CollectionListResult { collections, has_more, total_count })
      })
    }
  }
}

#[tauri::command]
pub async fn collection_describe(connId: String, name: String) -> Result<CollectionSchema, String> {
  validate_conn_id(&connId)?;
  validate_name(&name)?;
  let entry = get_connection_entry(&connId).await?;

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
pub async fn collection_stats(connId: String, name: String) -> Result<CollectionStats, String> {
  validate_conn_id(&connId)?;
  let entry = get_connection_entry(&connId).await?;

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
pub async fn collection_create(connId: String, name: String) -> Result<(), String> {
  validate_conn_id(&connId)?;
  let entry = get_connection_entry(&connId).await?;
  dispatch_provider!(entry, provider => {
      provider.create_collection(&name, None).await.map_err_string()
  })
}

#[tauri::command]
pub async fn collection_drop(connId: String, name: String) -> Result<(), String> {
  validate_conn_id(&connId)?;
  let entry = get_connection_entry(&connId).await?;
  dispatch_provider!(entry, provider => {
      provider.drop_collection(&name).await.map_err_string()
  })
}

#[tauri::command]
pub async fn collection_rename(
  connId: String,
  oldName: String,
  newName: String,
) -> Result<(), String> {
  validate_conn_id(&connId)?;
  validate_name(&oldName)?;
  validate_name(&newName)?;
  let entry = get_connection_entry(&connId).await?;
  dispatch_provider!(entry, provider => {
      let data = provider.find_many(&oldName, None, None, None, None, true).await.map_err_string()?;
      for item in data {
          provider.insert(&newName, item.clone()).await.map_err_string()?;
      }
      provider.drop_collection(&oldName).await.map_err_string()
  })
}

async fn list_all_json_collections_recursive(
  path_obj: std::path::PathBuf,
  offset: usize,
  limit: usize,
) -> Result<CollectionListResult, String> {
  let timeout_result =
    tokio::time::timeout(std::time::Duration::from_secs(SCAN_TIMEOUT_SECS), async {
      let mut collections: Vec<CollectionMeta> = Vec::new();
      let mut dirs_to_scan: Vec<(std::path::PathBuf, usize)> = vec![(path_obj, 0)];
      let mut total_count = 0usize;

      while let Some((current_dir, depth)) = dirs_to_scan.pop() {
        if depth >= MAX_DEPTH {
          continue;
        }

        let mut entries = match tokio::fs::read_dir(&current_dir).await {
          Ok(e) => e,
          Err(_) => continue,
        };

        while let Some(entry) = entries.next_entry().await.map_err_string()? {
          let entry_path = entry.path();

          if entry_path.is_dir() {
            dirs_to_scan.push((entry_path, depth + 1));
          } else if entry_path.extension().is_some_and(|ext| ext == "json") {
            total_count += 1;
            if total_count <= MAX_COLLECTIONS_TOTAL && collections.len() < limit * 2 {
              let name = entry
                .file_name()
                .into_string()
                .ok()
                .map(|n| n.trim_end_matches(".json").to_string());

              if let Some(name) = name {
                collections.push(CollectionMeta { name, count: 0 });
              }
            }
          }
        }
      }

      collections.sort_by(|a, b| a.name.cmp(&b.name));
      let total = collections.len();
      let has_more = offset + limit < total_count.min(MAX_COLLECTIONS_TOTAL);
      let result = collections.into_iter().skip(offset).take(limit).collect();

      Ok(CollectionListResult {
        collections: result,
        has_more,
        total_count: total_count.min(MAX_COLLECTIONS_TOTAL),
      })
    })
    .await;

  match timeout_result {
    Ok(Ok(result)) => Ok(result),
    Ok(Err(e)) => Err(e),
    Err(_) => Err("Collection listing timed out".to_string()),
  }
}

async fn list_json_files_in_dir(
  path_obj: std::path::PathBuf,
  offset: usize,
  limit: usize,
) -> Result<CollectionListResult, String> {
  let timeout_result =
    tokio::time::timeout(std::time::Duration::from_secs(SCAN_TIMEOUT_SECS), async {
      let mut entries = match tokio::fs::read_dir(&path_obj).await {
        Ok(e) => e,
        Err(_) => {
          return Ok(CollectionListResult {
            collections: Vec::new(),
            has_more: false,
            total_count: 0,
          })
        }
      };

      let mut all_collections: Vec<CollectionMeta> = Vec::new();

      while let Some(entry) = entries.next_entry().await.map_err_string()? {
        let entry_path = entry.path();
        if entry_path.is_file() && entry_path.extension().is_some_and(|ext| ext == "json") {
          if all_collections.len() < MAX_FILES_PER_DIR {
            let file_name = entry
              .file_name()
              .into_string()
              .ok()
              .map(|n| n.trim_end_matches(".json").to_string());

            if let Some(name) = file_name {
              all_collections.push(CollectionMeta { name, count: 0 });
            }
          }
        }
      }

      all_collections.sort_by(|a, b| a.name.cmp(&b.name));
      let total_count = all_collections.len();
      let has_more = offset + limit < total_count;
      let collections = all_collections
        .into_iter()
        .skip(offset)
        .take(limit)
        .collect();

      Ok(CollectionListResult {
        collections,
        has_more,
        total_count,
      })
    })
    .await;

  match timeout_result {
    Ok(Ok(result)) => Ok(result),
    Ok(Err(e)) => Err(e),
    Err(_) => Err("Collection listing timed out".to_string()),
  }
}
