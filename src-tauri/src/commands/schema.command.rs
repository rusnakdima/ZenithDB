use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::get_connection_entry_with_timer;
use crate::commands::types::{CollectionMeta, CollectionSchema, CollectionStats, ColumnInfo};
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::dispatch_provider;
use crate::models::response::{success, ResponseModel};
use crate::utils::metrics::{redact_sensitive_data, DataflowTimer};
use nosql_orm::prelude::*;
use serde_json::Value;
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
) -> Result<ResponseModel, String> {
  let timer = DataflowTimer::new("collection_list");
  let params = serde_json::json!({ "conn_id": &conn_id, "db_name": &db_name, "offset": offset, "limit": limit });
  if let Err(e) = validate_conn_id(&conn_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry_with_timer(&conn_id, &timer).await {
    Ok(e) => e,
    Err(e) => return Err(e),
  };
  let result = match dispatch_provider!(entry, conn_id, provider => {
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
    Ok(r) => success(
      "Collections listed",
      serde_json::to_value(r).unwrap_or(serde_json::Value::Null),
    ),
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  timer.finish_success();
  Ok(result)
}
#[tauri::command(rename_all = "camelCase")]
pub async fn collection_stats(
  connection_id: String,
  name: String,
) -> Result<ResponseModel, String> {
  let timer = DataflowTimer::new("collection_stats");
  let params = serde_json::json!({ "connection_id": &connection_id, "name": &name });
  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry_with_timer(&connection_id, &timer).await {
    Ok(e) => e,
    Err(e) => return Err(e),
  };
  let result = match dispatch_provider!(entry, connection_id, provider => {
      let stats = provider.get_collection_stats(&name).await.map_err_string()?;
      Ok::<_, String>(CollectionStats {
          name,
          document_count: stats.document_count,
          size_bytes: stats.size_bytes,
          index_count: stats.index_count,
      })
  }) {
    Ok(r) => success(
      "Collection stats retrieved",
      serde_json::to_value(r).unwrap_or(serde_json::Value::Null),
    ),
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  timer.finish_success();
  Ok(result)
}
#[tauri::command(rename_all = "camelCase")]
pub async fn collection_create(
  connection_id: String,
  name: String,
) -> Result<ResponseModel, String> {
  let timer = DataflowTimer::new("collection_create");
  let params = serde_json::json!({ "connection_id": &connection_id, "name": &name });
  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&name) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry_with_timer(&connection_id, &timer).await {
    Ok(e) => e,
    Err(e) => return Err(e),
  };
  let result = match dispatch_provider!(entry, connection_id, provider => {
      provider.create_collection(&name, None).await.map_err_string()
  }) {
    Ok(_) => success("Collection created", Value::Null),
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  timer.finish_success();
  Ok(result)
}
#[tauri::command(rename_all = "camelCase")]
pub async fn collection_drop(connection_id: String, name: String) -> Result<ResponseModel, String> {
  let timer = DataflowTimer::new("collection_drop");
  let params = serde_json::json!({ "connection_id": &connection_id, "name": &name });
  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&name) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry_with_timer(&connection_id, &timer).await {
    Ok(e) => e,
    Err(e) => return Err(e),
  };
  let result = match dispatch_provider!(entry, connection_id, provider => {
      provider.drop_collection(&name).await.map_err_string()
  }) {
    Ok(_) => success("Collection dropped", Value::Null),
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  timer.finish_success();
  Ok(result)
}
#[tauri::command(rename_all = "camelCase")]
pub async fn collection_rename(
  connection_id: String,
  db_name: Option<String>,
  oldName: String,
  newName: String,
) -> Result<ResponseModel, String> {
  let timer = DataflowTimer::new("collection_rename");
  let params = serde_json::json!({ "connection_id": &connection_id, "db_name": &db_name, "oldName": &oldName, "newName": &newName });
  if let Err(e) = validate_conn_id(&connection_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&oldName) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&newName) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry_with_timer(&connection_id, &timer).await {
    Ok(e) => e,
    Err(e) => return Err(e),
  };
  let result = match dispatch_provider!(entry, connection_id, provider => {
      provider.rename_collection(&oldName, &newName).await.map_err_string()
  }) {
    Ok(_) => success("Collection renamed", Value::Null),
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  timer.finish_success();
  Ok(result)
}
#[tauri::command(rename_all = "camelCase")]
pub async fn describe_collection(
  connection_id: &str,
  collection: &str,
) -> Result<ResponseModel, String> {
  let timer = DataflowTimer::new("describe_collection");
  let result: Result<ResponseModel, String> = (|| async {
    validate_conn_id(connection_id).map_err(|e| e.to_string())?;
    validate_name(collection).map_err(|e| e.to_string())?;
    let entry = get_connection_entry(connection_id)
      .await
      .map_err(|e| e.to_string())?;
    let (schema, indexes) = dispatch_provider!(entry, connection_id, provider => {
        let schema = provider.describe_collection(collection).await.map_err_string()?;
        let indexes = nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, collection)
            .await
            .map_err_string()?;
        Ok::<_, String>((schema, indexes))
    })
    .map_err(|e| e.to_string())?;
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
    Ok(success(
      "Collection described",
      serde_json::to_value(CollectionSchema {
        name: collection.to_string(),
        columns,
        indexes: index_infos,
      })
      .unwrap_or(serde_json::Value::Null),
    ))
  })()
  .await;
  match &result {
    Ok(resp) => timer.finish_success(),
    Err(err) => timer.finish_error(err),
  }
  result
}

#[tauri::command]
pub fn get_ui_schema() -> Result<String, String> {
  let path = std::path::PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| ".".to_string()))
    .join(".zenithdb")
    .join("ui_schema.json");

  if path.exists() {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
  } else {
    Ok(r#"{"schemaVersion":"1.0.0","app":{"id":"zenithdb","name":"ZenithDB","version":"1.0.0"},"pages":[],"layouts":[],"components":[],"sharedComponents":[],"services":[],"modules":[],"i18n":{"locale":"en","translations":{}}}"#.to_string())
  }
}
