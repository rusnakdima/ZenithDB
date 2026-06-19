use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::dispatch_provider;
use crate::models::response::ResponseModel;
use crate::utils::logger::{redact_sensitive_data, DataflowTimer};
use nosql_orm::prelude::*;
use serde_json::Value;

#[tauri::command]
pub async fn initialize_app() -> Result<(), String> {
  log::info!("[initialize_app] called");
  Ok(())
}

#[tauri::command]
pub async fn get_version() -> Result<String, String> {
  log::info!("[get_version] called");
  Ok(env!("CARGO_PKG_VERSION").to_string())
}

#[tauri::command]
pub async fn is_connected() -> Result<bool, String> {
  log::info!("[is_connected] called");
  Ok(true)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn rebuild_index(
  conn_id: String,
  collection: String,
  index_name: String,
) -> Result<(), String> {
  let timer = DataflowTimer::new("rebuild_index");
  let params = serde_json::json!({ "conn_id": &conn_id, "collection": &collection, "index_name": &index_name });
  log::debug!(
    "command = rebuild_index, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  if let Err(e) = validate_conn_id(&conn_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let _entry = match get_connection_entry(&conn_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  timer.finish(&ResponseModel::success(()));
  Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn create_index(
  conn_id: String,
  collection: String,
  _index_definition: Value,
) -> Result<(), String> {
  let timer = DataflowTimer::new("create_index");
  let params = serde_json::json!({
      "conn_id": &conn_id,
      "collection": &collection,
  });
  log::debug!(
    "command = create_index, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  if let Err(e) = validate_conn_id(&conn_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let _entry = match get_connection_entry(&conn_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  timer.finish(&ResponseModel::success(()));
  Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn drop_index(
  conn_id: String,
  collection: String,
  index_name: String,
) -> Result<(), String> {
  let timer = DataflowTimer::new("drop_index");
  let params = serde_json::json!({ "conn_id": &conn_id, "collection": &collection, "index_name": &index_name });
  log::debug!(
    "command = drop_index, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  if let Err(e) = validate_conn_id(&conn_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let _entry = match get_connection_entry(&conn_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  timer.finish(&ResponseModel::success(()));
  Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn insert_document(
  conn_id: String,
  collection: String,
  data: Value,
) -> Result<Value, String> {
  let timer = DataflowTimer::new("insert_document");
  let params = serde_json::json!({ "conn_id": &conn_id, "collection": &collection, "data": &data });
  log::debug!(
    "command = insert_document, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  if let Err(e) = validate_conn_id(&conn_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&conn_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  match dispatch_provider!(entry, provider => { provider.insert(&collection, data).await.map_err_string() })
  {
    Ok(result) => {
      timer.finish(&ResponseModel::success(&result));
      Ok(result)
    }
    Err(e) => {
      timer.clone().finish_error(&e);
      Err(e)
    }
  }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn update_document(
  conn_id: String,
  collection: String,
  id: String,
  data: Value,
) -> Result<Value, String> {
  let timer = DataflowTimer::new("update_document");
  let params =
    serde_json::json!({ "conn_id": &conn_id, "collection": &collection, "id": &id, "data": &data });
  log::debug!(
    "command = update_document, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  if let Err(e) = validate_conn_id(&conn_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&conn_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  match dispatch_provider!(entry, provider => { provider.update(&collection, &id, data).await.map_err_string() })
  {
    Ok(result) => {
      timer.finish(&ResponseModel::success(&result));
      Ok(result)
    }
    Err(e) => {
      timer.clone().finish_error(&e);
      Err(e)
    }
  }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn delete_document(
  conn_id: String,
  collection: String,
  id: String,
) -> Result<(), String> {
  let timer = DataflowTimer::new("delete_document");
  let params = serde_json::json!({ "conn_id": &conn_id, "collection": &collection, "id": &id });
  log::debug!(
    "command = delete_document, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  if let Err(e) = validate_conn_id(&conn_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&conn_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  match dispatch_provider!(entry, provider => { provider.delete(&collection, &id).await.map_err_string() })
  {
    Ok(_) => {
      timer.finish(&ResponseModel::success(()));
      Ok(())
    }
    Err(e) => {
      timer.clone().finish_error(&e);
      Err(e)
    }
  }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn soft_delete_document(
  conn_id: String,
  collection: String,
  id: String,
) -> Result<(), String> {
  let timer = DataflowTimer::new("soft_delete_document");
  let params = serde_json::json!({ "conn_id": &conn_id, "collection": &collection, "id": &id });
  log::debug!(
    "command = soft_delete_document, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  if let Err(e) = validate_conn_id(&conn_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&conn_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  let deleted_data: Value = serde_json::json!({
    "_deleted": true,
    "_deleted_at": chrono::Utc::now().to_rfc3339()
  });
  match dispatch_provider!(entry, provider => { provider.update(&collection, &id, deleted_data).await.map_err_string() })
  {
    Ok(_) => {
      timer.finish(&ResponseModel::success(()));
      Ok(())
    }
    Err(e) => {
      timer.clone().finish_error(&e);
      Err(e)
    }
  }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TransactionResult {
  pub transaction_id: String,
}

#[tauri::command(rename_all = "camelCase")]
pub async fn begin_transaction(
  conn_id: String,
  _isolation_level: Option<String>,
) -> Result<TransactionResult, String> {
  let timer = DataflowTimer::new("begin_transaction");
  let params = serde_json::json!({ "conn_id": &conn_id });
  log::debug!(
    "command = begin_transaction, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  if let Err(e) = validate_conn_id(&conn_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  let entry = match get_connection_entry(&conn_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  match dispatch_provider!(entry, provider => {
      provider.begin_transaction().await.map_err_string()
  }) {
    Ok(transaction_id) => {
      let result = TransactionResult {
        transaction_id: transaction_id.to_string(),
      };
      timer.finish(&ResponseModel::success(&result));
      Ok(result)
    }
    Err(e) => {
      timer.clone().finish_error(&e);
      Err(e)
    }
  }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn commit_transaction(_transaction_id: String) -> Result<(), String> {
  let timer = DataflowTimer::new("commit_transaction");
  log::debug!(
    "command = commit_transaction, params = {{ \"transaction_id\": \"***\" }} [COMMAND_ENTRY]"
  );
  timer.finish(&ResponseModel::success(()));
  Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn rollback_transaction(_transaction_id: String) -> Result<(), String> {
  let timer = DataflowTimer::new("rollback_transaction");
  log::debug!(
    "command = rollback_transaction, params = {{ \"transaction_id\": \"***\" }} [COMMAND_ENTRY]"
  );
  timer.finish(&ResponseModel::success(()));
  Ok(())
}
