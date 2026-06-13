use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::types::{CollectionMeta, CollectionSchema, CollectionStats};
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::dispatch_provider;
use crate::logger::{redact_sensitive_data, DataflowTimer};
use crate::models::response::ResponseModel;
use nosql_orm::prelude::*;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CollectionListResult {
  pub collections: Vec<CollectionMeta>,
  pub has_more: bool,
  pub total_count: usize,
}

#[tauri::command]
pub async fn collection_list(
  connection_id: String,
  _db_name: Option<String>,
  offset: Option<usize>,
  limit: Option<usize>,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("collection_list");
  let params = serde_json::json!({ "connection_id": &connection_id, "_db_name": _db_name, "offset": offset, "limit": limit });
  tracing::debug!(command = "collection_list", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");

  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }

  let entry = match get_connection_entry(&connection_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(ResponseModel::error(e));
    }
  };

  let result = match dispatch_provider!(entry, provider => {
      let collections = provider.list_collections().await.map_err_string()?;
      let total_count = collections.len();
      let offset = offset.unwrap_or(0);
      let limit = limit.unwrap_or(usize::MAX);
      let has_more = offset + limit < total_count;
      let cols: Vec<CollectionMeta> = collections
          .into_iter()
          .skip(offset)
          .take(limit)
          .map(|c| CollectionMeta { name: c.name, count: c.document_count })
          .collect();
      Ok::<_, String>(CollectionListResult {
          collections: cols,
          has_more,
          total_count,
      })
  }) {
    Ok(r) => ResponseModel::success(r),
    Err(e) => {
      timer.clone().finish_error(&e);
      ResponseModel::error(e)
    }
  };

  timer.finish(&result);
  Ok(result)
}

#[tauri::command]
pub async fn collection_describe(
  connection_id: String,
  name: String,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("collection_describe");
  let params = serde_json::json!({ "connection_id": &connection_id, "name": &name });
  tracing::debug!(command = "collection_describe", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");

  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  if let Err(e) = validate_name(&name) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }

  let entry = match get_connection_entry(&connection_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(ResponseModel::error(e));
    }
  };

  let result = match dispatch_provider!(entry, provider => {
      let schema = provider.describe_collection(&name).await.map_err_string()?;
      let columns: Vec<crate::commands::types::ColumnInfo> = schema
          .fields
          .iter()
          .map(|(name, field)| crate::commands::types::ColumnInfo {
              name: name.clone(),
              data_type: field.field_type.clone(),
              nullable: field.nullable,
              is_primary_key: false,
          })
          .collect();
      Ok::<_, String>(CollectionSchema {
          name,
          columns,
          indexes: vec![],
      })
  }) {
    Ok(r) => ResponseModel::success(r),
    Err(e) => {
      timer.clone().finish_error(&e);
      ResponseModel::error(e)
    }
  };

  timer.finish(&result);
  Ok(result)
}

#[tauri::command]
pub async fn collection_stats(
  connection_id: String,
  name: String,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("collection_stats");
  let params = serde_json::json!({ "connection_id": &connection_id, "name": &name });
  tracing::debug!(command = "collection_stats", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");

  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }

  let entry = match get_connection_entry(&connection_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(ResponseModel::error(e));
    }
  };

  let result = match dispatch_provider!(entry, provider => {
      let stats = provider.get_collection_stats(&name).await.map_err_string()?;
      Ok::<_, String>(CollectionStats {
          name,
          document_count: stats.document_count,
          size_bytes: stats.size_bytes,
          index_count: stats.index_count,
      })
  }) {
    Ok(r) => ResponseModel::success(r),
    Err(e) => {
      timer.clone().finish_error(&e);
      ResponseModel::error(e)
    }
  };

  timer.finish(&result);
  Ok(result)
}

#[tauri::command]
pub async fn collection_create(
  connection_id: String,
  name: String,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("collection_create");
  let params = serde_json::json!({ "connection_id": &connection_id, "name": &name });
  tracing::debug!(command = "collection_create", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");

  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  if let Err(e) = validate_name(&name) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }

  let entry = match get_connection_entry(&connection_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(ResponseModel::error(e));
    }
  };

  let result = match dispatch_provider!(entry, provider => {
      provider.create_collection(&name, None).await.map_err_string()
  }) {
    Ok(_) => ResponseModel::success_message("Collection created"),
    Err(e) => {
      timer.clone().finish_error(&e);
      ResponseModel::error(e)
    }
  };

  timer.finish(&result);
  Ok(result)
}

#[tauri::command]
pub async fn collection_drop(
  connection_id: String,
  name: String,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("collection_drop");
  let params = serde_json::json!({ "connection_id": &connection_id, "name": &name });
  tracing::debug!(command = "collection_drop", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");

  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  if let Err(e) = validate_name(&name) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }

  let entry = match get_connection_entry(&connection_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(ResponseModel::error(e));
    }
  };

  let result = match dispatch_provider!(entry, provider => {
      provider.drop_collection(&name).await.map_err_string()
  }) {
    Ok(_) => ResponseModel::success_message("Collection dropped"),
    Err(e) => {
      timer.clone().finish_error(&e);
      ResponseModel::error(e)
    }
  };

  timer.finish(&result);
  Ok(result)
}

#[tauri::command]
pub async fn collection_rename(
  connection_id: String,
  old_name: String,
  new_name: String,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("collection_rename");
  let params = serde_json::json!({ "connection_id": &connection_id, "old_name": &old_name, "new_name": &new_name });
  tracing::debug!(command = "collection_rename", params = %redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default()), "[COMMAND_ENTRY]");

  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  if let Err(e) = validate_name(&old_name) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  if let Err(e) = validate_name(&new_name) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }

  let entry = match get_connection_entry(&connection_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(ResponseModel::error(e));
    }
  };

  let result = match dispatch_provider!(entry, provider => {
      provider.rename_collection(&old_name, &new_name).await.map_err_string()
  }) {
    Ok(_) => ResponseModel::success_message("Collection renamed"),
    Err(e) => {
      timer.clone().finish_error(&e);
      ResponseModel::error(e)
    }
  };

  timer.finish(&result);
  Ok(result)
}
