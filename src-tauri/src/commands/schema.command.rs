use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::get_connection_entry_with_timer;
use crate::commands::types::{CollectionMeta, CollectionSchema, CollectionStats, ColumnInfo};
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::dispatch_provider;
use crate::models::response::ResponseModel;
use crate::utils::metrics::{redact_sensitive_data, DataflowTimer};
use nosql_orm::prelude::*;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CollectionListResult {
  pub collections: Vec<CollectionMeta>,
  pub has_more: bool,
  pub total_count: usize,
}

#[tauri::command(rename_all = "camelCase")]
pub async fn collection_list(
  conn_id: String,
  db_name: Option<String>,
  offset: Option<usize>,
  limit: Option<usize>,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("collection_list");
  let params = serde_json::json!({ "conn_id": &conn_id, "db_name": &db_name, "offset": offset, "limit": limit });
  log::debug!(
    "command = collection_list, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );

  if let Err(e) = validate_conn_id(&conn_id) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }

  let entry = match get_connection_entry_with_timer(&conn_id, &timer).await {
    Ok(e) => e,
    Err(e) => return Err(e),
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

  timer.finish_success();
  Ok(result)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn collection_stats(
  connection_id: String,
  name: String,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("collection_stats");
  let params = serde_json::json!({ "connection_id": &connection_id, "name": &name });
  log::debug!(
    "command = collection_stats, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );

  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }

  let entry = match get_connection_entry_with_timer(&connection_id, &timer).await {
    Ok(e) => e,
    Err(e) => return Err(e),
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

  timer.finish_success();
  Ok(result)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn collection_create(
  connection_id: String,
  name: String,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("collection_create");
  let params = serde_json::json!({ "connection_id": &connection_id, "name": &name });
  log::debug!(
    "command = collection_create, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );

  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  if let Err(e) = validate_name(&name) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }

  let entry = match get_connection_entry_with_timer(&connection_id, &timer).await {
    Ok(e) => e,
    Err(e) => return Err(e),
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

  timer.finish_success();
  Ok(result)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn collection_drop(
  connection_id: String,
  name: String,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("collection_drop");
  let params = serde_json::json!({ "connection_id": &connection_id, "name": &name });
  log::debug!(
    "command = collection_drop, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );

  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  if let Err(e) = validate_name(&name) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }

  let entry = match get_connection_entry_with_timer(&connection_id, &timer).await {
    Ok(e) => e,
    Err(e) => return Err(e),
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

  timer.finish_success();
  Ok(result)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn collection_rename(
  connection_id: String,
  oldName: String,
  newName: String,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("collection_rename");
  let params = serde_json::json!({ "connection_id": &connection_id, "oldName": &oldName, "newName": &newName });
  log::debug!(
    "command = collection_rename, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );

  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  if let Err(e) = validate_name(&oldName) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }
  if let Err(e) = validate_name(&newName) {
    timer.clone().finish_error(&e);
    return Err(ResponseModel::error(e));
  }

  let entry = match get_connection_entry_with_timer(&connection_id, &timer).await {
    Ok(e) => e,
    Err(e) => return Err(e),
  };

  let result = match dispatch_provider!(entry, provider => {
      provider.rename_collection(&oldName, &newName).await.map_err_string()
  }) {
    Ok(_) => ResponseModel::success_message("Collection renamed"),
    Err(e) => {
      timer.clone().finish_error(&e);
      ResponseModel::error(e)
    }
  };

  timer.finish_success();
  Ok(result)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn describe_collection(
  connection_id: &str,
  collection: &str,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("describe_collection");
  let result: Result<ResponseModel, ResponseModel> = (|| async {
    validate_conn_id(connection_id).map_err(|e| ResponseModel::error(e))?;
    validate_name(collection).map_err(|e| ResponseModel::error(e))?;
    let entry = get_connection_entry(connection_id)
      .await
      .map_err(|e| ResponseModel::error(e))?;

    let (schema, indexes) = dispatch_provider!(entry, provider => {
        let schema = provider.describe_collection(collection).await.map_err_string()?;
        let indexes = nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, collection)
            .await
            .map_err_string()?;
        Ok::<_, String>((schema, indexes))
    })
    .map_err(|e| ResponseModel::error(e))?;

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

    Ok(ResponseModel::success(CollectionSchema {
      name: collection.to_string(),
      columns,
      indexes: index_infos,
    }))
  })()
  .await;
  match &result {
    Ok(resp) => timer.finish_success(),
    Err(err) => timer.finish_error(&err.message),
  }
  result
}
