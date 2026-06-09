use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::types::{CollectionMeta, CollectionSchema, CollectionStats, ColumnInfo};
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::dispatch_provider;
use crate::models::response::ResponseModel;
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, BufReader};

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

#[tauri::command]
pub async fn collection_list(
  conn_id: String,
  _db_name: Option<String>,
  offset: Option<usize>,
  limit: Option<usize>,
) -> Result<CollectionListResult, String> {
  validate_conn_id(&conn_id)?;
  let entry = get_connection_entry(&conn_id).await?;
  let offset = offset.unwrap_or(0);
  let limit = limit.unwrap_or(10000);

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

  let index_infos: Vec<crate::commands::types::IndexInfo> = indexes
    .into_iter()
    .map(|idx| crate::commands::types::IndexInfo {
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
  let entry = get_connection_entry(&conn_id).await?;
  dispatch_provider!(entry, provider => {
      provider.create_collection(&name, None).await.map_err_string()
  })
}

#[tauri::command]
pub async fn collection_drop(conn_id: String, name: String) -> Result<(), String> {
  validate_conn_id(&conn_id)?;
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
                let count = count_jsonl_documents(&entry_path).await.unwrap_or(0);
                collections.push(CollectionMeta { name, count });
              }
            }
          }
        }
      }

      collections.sort_by(|a, b| a.name.cmp(&b.name));
      let total_count = collections.len();
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

async fn count_jsonl_documents(path: &std::path::Path) -> Result<u64, String> {
  let file = tokio::fs::File::open(path).await.map_err_string()?;
  let reader = BufReader::new(file);
  let mut lines = reader.lines();
  let mut count = 0u64;
  while let Some(line) = lines.next_line().await.map_err_string()? {
    let trimmed = line.trim();
    if !trimmed.is_empty() && trimmed.starts_with('{') {
      count += 1;
    }
  }
  Ok(count)
}
