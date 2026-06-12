use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::types::{CollectionMeta, CollectionSchema, CollectionStats, ColumnInfo};
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::logger::{redact_sensitive_data, DataflowTimer};
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
  connId: String,
  _db_name: Option<String>,
  offset: Option<usize>,
  limit: Option<usize>,
) -> Result<CollectionListResult, String> {
  let timer = DataflowTimer::new("collection_list");
  let params = serde_json::json!({ "connId": &connId, "_db_name": _db_name, "offset": offset, "limit": limit });
  tracing::debug!(command = "collection_list", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");

  if let Err(e) = validate_conn_id(&connId) {
    timer.finish_error(&e);
    return Err(e);
  }

  let entry = match get_connection_entry(&connId).await {
    Ok(e) => e,
    Err(e) => {
      timer.finish_error(&e);
      return Err(e);
    }
  };

  let offset = offset.unwrap_or(0);
  let limit = limit.unwrap_or(10000);

  let result = match &entry.config.config {
    crate::commands::connection::ConnectionConfigEnum::Json { path, .. } => {
      let path_obj = std::path::Path::new(path).to_path_buf();
      if !path_obj.is_dir() {
        let result = CollectionListResult {
          collections: Vec::new(),
          has_more: false,
          total_count: 0,
        };
        timer.finish(&ResponseModel::success(&result));
        return Ok(result);
      }
      match list_all_json_collections_recursive(path_obj, offset, limit).await {
        Ok(r) => {
          timer.finish(&ResponseModel::success(&r));
          r
        }
        Err(e) => {
          timer.finish_error(&e);
          return Err(e);
        }
      }
    }
    crate::commands::connection::ConnectionConfigEnum::Mongo { uri, database, .. } => {
      let provider = crate::commands::provider::create_mongo_provider(uri, database)
        .await
        .map_err_string()?;
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
      let result = CollectionListResult {
        collections,
        has_more,
        total_count,
      };
      timer.finish(&ResponseModel::success(&result));
      result
    }
    crate::commands::connection::ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri)
        .await
        .map_err_string()?;
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
      let result = CollectionListResult {
        collections,
        has_more,
        total_count,
      };
      timer.finish(&ResponseModel::success(&result));
      result
    }
    crate::commands::connection::ConnectionConfigEnum::Redis { uri, .. } => {
      let provider = crate::commands::provider::create_redis_provider(uri)
        .await
        .map_err_string()?;
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
      let result = CollectionListResult {
        collections,
        has_more,
        total_count,
      };
      timer.finish(&ResponseModel::success(&result));
      result
    }
    crate::commands::connection::ConnectionConfigEnum::Sqlite { path, .. } => {
      let provider = crate::commands::provider::create_sqlite_provider(path)
        .await
        .map_err_string()?;
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
      let result = CollectionListResult {
        collections,
        has_more,
        total_count,
      };
      timer.finish(&ResponseModel::success(&result));
      result
    }
    crate::commands::connection::ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::create_mysql_provider(uri)
        .await
        .map_err_string()?;
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
      let result = CollectionListResult {
        collections,
        has_more,
        total_count,
      };
      timer.finish(&ResponseModel::success(&result));
      result
    }
  };
  Ok(result)
}

#[tauri::command]
pub async fn collection_describe(connId: String, name: String) -> Result<CollectionSchema, String> {
  let timer = DataflowTimer::new("collection_describe");
  let params = serde_json::json!({ "connId": &connId, "name": &name });
  tracing::debug!(command = "collection_describe", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");

  if let Err(e) = validate_conn_id(&connId) {
    timer.finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&name) {
    timer.finish_error(&e);
    return Err(e);
  }

  let entry = match get_connection_entry(&connId).await {
    Ok(e) => e,
    Err(e) => {
      timer.finish_error(&e);
      return Err(e);
    }
  };

  let result = match &entry.config.config {
    crate::commands::connection::ConnectionConfigEnum::Mongo { uri, database, .. } => {
      let provider = crate::commands::provider::create_mongo_provider(uri, database)
        .await
        .map_err_string()?;
      let schema = provider.describe_collection(&name).await.map_err_string()?;
      let indexes = nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, &name)
        .await
        .map_err_string()?;
      let columns: Vec<ColumnInfo> = schema
        .fields
        .iter()
        .map(|(n, field)| ColumnInfo {
          name: n.clone(),
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
      CollectionSchema {
        name,
        columns,
        indexes: index_infos,
      }
    }
    crate::commands::connection::ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri)
        .await
        .map_err_string()?;
      let schema = provider.describe_collection(&name).await.map_err_string()?;
      let indexes = nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, &name)
        .await
        .map_err_string()?;
      let columns: Vec<ColumnInfo> = schema
        .fields
        .iter()
        .map(|(n, field)| ColumnInfo {
          name: n.clone(),
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
      CollectionSchema {
        name,
        columns,
        indexes: index_infos,
      }
    }
    crate::commands::connection::ConnectionConfigEnum::Redis { uri, .. } => {
      let provider = crate::commands::provider::create_redis_provider(uri)
        .await
        .map_err_string()?;
      let schema = provider.describe_collection(&name).await.map_err_string()?;
      let indexes = nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, &name)
        .await
        .map_err_string()?;
      let columns: Vec<ColumnInfo> = schema
        .fields
        .iter()
        .map(|(n, field)| ColumnInfo {
          name: n.clone(),
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
      CollectionSchema {
        name,
        columns,
        indexes: index_infos,
      }
    }
    crate::commands::connection::ConnectionConfigEnum::Sqlite { path, .. } => {
      let provider = crate::commands::provider::create_sqlite_provider(path)
        .await
        .map_err_string()?;
      let schema = provider.describe_collection(&name).await.map_err_string()?;
      let indexes = nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, &name)
        .await
        .map_err_string()?;
      let columns: Vec<ColumnInfo> = schema
        .fields
        .iter()
        .map(|(n, field)| ColumnInfo {
          name: n.clone(),
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
      CollectionSchema {
        name,
        columns,
        indexes: index_infos,
      }
    }
    crate::commands::connection::ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::create_mysql_provider(uri)
        .await
        .map_err_string()?;
      let schema = provider.describe_collection(&name).await.map_err_string()?;
      let indexes = nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, &name)
        .await
        .map_err_string()?;
      let columns: Vec<ColumnInfo> = schema
        .fields
        .iter()
        .map(|(n, field)| ColumnInfo {
          name: n.clone(),
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
      CollectionSchema {
        name,
        columns,
        indexes: index_infos,
      }
    }
    crate::commands::connection::ConnectionConfigEnum::Json { path, .. } => {
      let provider = crate::commands::provider::create_json_provider(path)
        .await
        .map_err_string()?;
      let schema = provider.describe_collection(&name).await.map_err_string()?;
      let indexes = nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, &name)
        .await
        .map_err_string()?;
      let columns: Vec<ColumnInfo> = schema
        .fields
        .iter()
        .map(|(n, field)| ColumnInfo {
          name: n.clone(),
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
      CollectionSchema {
        name,
        columns,
        indexes: index_infos,
      }
    }
  };

  timer.finish(&ResponseModel::success(&result));
  Ok(result)
}

#[tauri::command]
pub async fn collection_stats(connId: String, name: String) -> Result<CollectionStats, String> {
  let timer = DataflowTimer::new("collection_stats");
  let params = serde_json::json!({ "connId": &connId, "name": &name });
  tracing::debug!(command = "collection_stats", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");

  if let Err(e) = validate_conn_id(&connId) {
    timer.finish_error(&e);
    return Err(e);
  }

  let entry = match get_connection_entry(&connId).await {
    Ok(e) => e,
    Err(e) => {
      timer.finish_error(&e);
      return Err(e);
    }
  };

  let stats = match &entry.config.config {
    crate::commands::connection::ConnectionConfigEnum::Mongo { uri, database, .. } => {
      let provider = crate::commands::provider::create_mongo_provider(uri, database)
        .await
        .map_err_string()?;
      provider
        .get_collection_stats(&name)
        .await
        .map_err_string()?
    }
    crate::commands::connection::ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri)
        .await
        .map_err_string()?;
      provider
        .get_collection_stats(&name)
        .await
        .map_err_string()?
    }
    crate::commands::connection::ConnectionConfigEnum::Redis { uri, .. } => {
      let provider = crate::commands::provider::create_redis_provider(uri)
        .await
        .map_err_string()?;
      provider
        .get_collection_stats(&name)
        .await
        .map_err_string()?
    }
    crate::commands::connection::ConnectionConfigEnum::Sqlite { path, .. } => {
      let provider = crate::commands::provider::create_sqlite_provider(path)
        .await
        .map_err_string()?;
      provider
        .get_collection_stats(&name)
        .await
        .map_err_string()?
    }
    crate::commands::connection::ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::create_mysql_provider(uri)
        .await
        .map_err_string()?;
      provider
        .get_collection_stats(&name)
        .await
        .map_err_string()?
    }
    crate::commands::connection::ConnectionConfigEnum::Json { path, .. } => {
      let provider = crate::commands::provider::create_json_provider(path)
        .await
        .map_err_string()?;
      provider
        .get_collection_stats(&name)
        .await
        .map_err_string()?
    }
  };

  let result = CollectionStats {
    name,
    document_count: stats.document_count,
    size_bytes: stats.size_bytes,
    index_count: stats.index_count,
  };
  timer.finish(&ResponseModel::success(&result));
  Ok(result)
}

#[tauri::command]
pub async fn collection_create(connId: String, name: String) -> Result<(), String> {
  let timer = DataflowTimer::new("collection_create");
  let params = serde_json::json!({ "connId": &connId, "name": &name });
  tracing::debug!(command = "collection_create", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");

  if let Err(e) = validate_conn_id(&connId) {
    timer.finish_error(&e);
    return Err(e);
  }

  let entry = match get_connection_entry(&connId).await {
    Ok(e) => e,
    Err(e) => {
      timer.finish_error(&e);
      return Err(e);
    }
  };

  match &entry.config.config {
    crate::commands::connection::ConnectionConfigEnum::Mongo { uri, database, .. } => {
      let provider = crate::commands::provider::create_mongo_provider(uri, database)
        .await
        .map_err_string()?;
      provider
        .create_collection(&name, None)
        .await
        .map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri)
        .await
        .map_err_string()?;
      provider
        .create_collection(&name, None)
        .await
        .map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::Redis { uri, .. } => {
      let provider = crate::commands::provider::create_redis_provider(uri)
        .await
        .map_err_string()?;
      provider
        .create_collection(&name, None)
        .await
        .map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::Sqlite { path, .. } => {
      let provider = crate::commands::provider::create_sqlite_provider(path)
        .await
        .map_err_string()?;
      provider
        .create_collection(&name, None)
        .await
        .map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::create_mysql_provider(uri)
        .await
        .map_err_string()?;
      provider
        .create_collection(&name, None)
        .await
        .map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::Json { path, .. } => {
      let provider = crate::commands::provider::create_json_provider(path)
        .await
        .map_err_string()?;
      provider
        .create_collection(&name, None)
        .await
        .map_err_string()?;
    }
  };

  timer.finish(&ResponseModel::success(&()));
  Ok(())
}

#[tauri::command]
pub async fn collection_drop(connId: String, name: String) -> Result<(), String> {
  let timer = DataflowTimer::new("collection_drop");
  let params = serde_json::json!({ "connId": &connId, "name": &name });
  tracing::debug!(command = "collection_drop", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");

  if let Err(e) = validate_conn_id(&connId) {
    timer.finish_error(&e);
    return Err(e);
  }

  let entry = match get_connection_entry(&connId).await {
    Ok(e) => e,
    Err(e) => {
      timer.finish_error(&e);
      return Err(e);
    }
  };

  match &entry.config.config {
    crate::commands::connection::ConnectionConfigEnum::Mongo { uri, database, .. } => {
      let provider = crate::commands::provider::create_mongo_provider(uri, database)
        .await
        .map_err_string()?;
      provider.drop_collection(&name).await.map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri)
        .await
        .map_err_string()?;
      provider.drop_collection(&name).await.map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::Redis { uri, .. } => {
      let provider = crate::commands::provider::create_redis_provider(uri)
        .await
        .map_err_string()?;
      provider.drop_collection(&name).await.map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::Sqlite { path, .. } => {
      let provider = crate::commands::provider::create_sqlite_provider(path)
        .await
        .map_err_string()?;
      provider.drop_collection(&name).await.map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::create_mysql_provider(uri)
        .await
        .map_err_string()?;
      provider.drop_collection(&name).await.map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::Json { path, .. } => {
      let provider = crate::commands::provider::create_json_provider(path)
        .await
        .map_err_string()?;
      provider.drop_collection(&name).await.map_err_string()?;
    }
  };

  timer.finish(&ResponseModel::success(&()));
  Ok(())
}

#[tauri::command]
pub async fn collection_rename(
  connId: String,
  old_name: String,
  new_name: String,
) -> Result<(), String> {
  let timer = DataflowTimer::new("collection_rename");
  let params =
    serde_json::json!({ "connId": &connId, "old_name": &old_name, "new_name": &new_name });
  tracing::debug!(command = "collection_rename", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");

  if let Err(e) = validate_conn_id(&connId) {
    timer.finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&old_name) {
    timer.finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&new_name) {
    timer.finish_error(&e);
    return Err(e);
  }

  let entry = match get_connection_entry(&connId).await {
    Ok(e) => e,
    Err(e) => {
      timer.finish_error(&e);
      return Err(e);
    }
  };

  match &entry.config.config {
    crate::commands::connection::ConnectionConfigEnum::Mongo { uri, database, .. } => {
      let provider = crate::commands::provider::create_mongo_provider(uri, database)
        .await
        .map_err_string()?;
      let data = provider
        .find_many(&old_name, None, None, None, None, true)
        .await
        .map_err_string()?;
      for item in data {
        provider
          .insert(&new_name, item.clone())
          .await
          .map_err_string()?;
      }
      provider.drop_collection(&old_name).await.map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri)
        .await
        .map_err_string()?;
      let data = provider
        .find_many(&old_name, None, None, None, None, true)
        .await
        .map_err_string()?;
      for item in data {
        provider
          .insert(&new_name, item.clone())
          .await
          .map_err_string()?;
      }
      provider.drop_collection(&old_name).await.map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::Redis { uri, .. } => {
      let provider = crate::commands::provider::create_redis_provider(uri)
        .await
        .map_err_string()?;
      let data = provider
        .find_many(&old_name, None, None, None, None, true)
        .await
        .map_err_string()?;
      for item in data {
        provider
          .insert(&new_name, item.clone())
          .await
          .map_err_string()?;
      }
      provider.drop_collection(&old_name).await.map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::Sqlite { path, .. } => {
      let provider = crate::commands::provider::create_sqlite_provider(path)
        .await
        .map_err_string()?;
      let data = provider
        .find_many(&old_name, None, None, None, None, true)
        .await
        .map_err_string()?;
      for item in data {
        provider
          .insert(&new_name, item.clone())
          .await
          .map_err_string()?;
      }
      provider.drop_collection(&old_name).await.map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::create_mysql_provider(uri)
        .await
        .map_err_string()?;
      let data = provider
        .find_many(&old_name, None, None, None, None, true)
        .await
        .map_err_string()?;
      for item in data {
        provider
          .insert(&new_name, item.clone())
          .await
          .map_err_string()?;
      }
      provider.drop_collection(&old_name).await.map_err_string()?;
    }
    crate::commands::connection::ConnectionConfigEnum::Json { path, .. } => {
      let provider = crate::commands::provider::create_json_provider(path)
        .await
        .map_err_string()?;
      let data = provider
        .find_many(&old_name, None, None, None, None, true)
        .await
        .map_err_string()?;
      for item in data {
        provider
          .insert(&new_name, item.clone())
          .await
          .map_err_string()?;
      }
      provider.drop_collection(&old_name).await.map_err_string()?;
    }
  };

  timer.finish(&ResponseModel::success(&()));
  Ok(())
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
