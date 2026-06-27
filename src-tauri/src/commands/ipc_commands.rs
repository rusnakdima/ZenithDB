use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::dispatch_provider;
use crate::models::response::{Response, ResponseModel};
use crate::utils::metrics::{redact_sensitive_data, DataflowTimer};
use nosql_orm::prelude::*;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

static TRANSACTION_REGISTRY: std::sync::OnceLock<Arc<RwLock<HashMap<String, String>>>> =
  std::sync::OnceLock::new();

fn get_transaction_registry() -> &'static Arc<RwLock<HashMap<String, String>>> {
  TRANSACTION_REGISTRY
    .get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
}

async fn store_transaction(conn_id: String, transaction_id: String) {
  let registry = get_transaction_registry();
  let mut guard = registry.write().await;
  guard.insert(transaction_id.clone(), conn_id);
}

async fn get_conn_id_for_transaction(transaction_id: &str) -> Option<String> {
  let registry = get_transaction_registry();
  let guard = registry.read().await;
  guard.get(transaction_id).cloned()
}

async fn remove_transaction(transaction_id: &str) {
  let registry = get_transaction_registry();
  let mut guard = registry.write().await;
  guard.remove(transaction_id);
}
#[tauri::command]
pub async fn initialize_app() -> Result<(), String> {
  Ok(())
}
#[tauri::command]
pub async fn get_version() -> Result<String, String> {
  Ok(env!("CARGO_PKG_VERSION").to_string())
}
#[tauri::command]
pub async fn is_connected() -> Result<bool, String> {
  Ok(true)
}
fn parse_index_definition(def: &Value) -> Result<NosqlIndex, String> {
  let name = def
    .get("name")
    .and_then(|v| v.as_str())
    .ok_or("Index definition must have a 'name' field")?;
  let index_type = def
    .get("type")
    .and_then(|v| v.as_str())
    .unwrap_or("single");
  let fields = def
    .get("fields")
    .and_then(|v| v.as_array())
    .ok_or("Index definition must have a 'fields' array")?;
  let options = def.get("options");

  let mut index = match index_type {
    "compound" => {
      let field_tuples: Vec<(&str, i32)> = fields
        .iter()
        .map(|f| {
          let field_name = f.get("name").and_then(|v| v.as_str()).unwrap_or("");
          let direction = f.get("direction").and_then(|v| v.as_str()).unwrap_or("asc");
          let order = if direction == "desc" { -1 } else { 1 };
          (field_name, order)
        })
        .collect();
      nosql_orm::nosql_index::NosqlIndex::compound(&field_tuples)
    }
    "text" => {
      let field_tuples: Vec<(&str, i32)> = fields
        .iter()
        .map(|f| {
          let field_name = f.get("name").and_then(|v| v.as_str()).unwrap_or("");
          let weight = f.get("weight").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
          (field_name, weight)
        })
        .collect();
      nosql_orm::nosql_index::NosqlIndex::text(&field_tuples)
    }
    "geospatial" => {
      let field_name = fields
        .first()
        .and_then(|f| f.get("name").and_then(|v| v.as_str()))
        .unwrap_or("location");
      nosql_orm::nosql_index::NosqlIndex::geospatial_2dsphere(field_name)
    }
    "hashed" => {
      let field_name = fields
        .first()
        .and_then(|f| f.get("name").and_then(|v| v.as_str()))
        .unwrap_or("_id");
      nosql_orm::nosql_index::NosqlIndex::hashed(field_name)
    }
    "ttl" => {
      let field_name = fields
        .first()
        .and_then(|f| f.get("name").and_then(|v| v.as_str()))
        .unwrap_or("created_at");
      let ttl_seconds = options
        .and_then(|o| o.get("ttlSeconds"))
        .and_then(|v| v.as_u64())
        .unwrap_or(3600) as u32;
      nosql_orm::nosql_index::NosqlIndex::ttl(field_name, ttl_seconds)
    }
    _ => {
      let field_name = fields
        .first()
        .and_then(|f| f.get("name").and_then(|v| v.as_str()))
        .unwrap_or("_id");
      let direction = fields
        .first()
        .and_then(|f| f.get("direction").and_then(|v| v.as_str()))
        .unwrap_or("asc");
      let order = if direction == "desc" { -1 } else { 1 };
      nosql_orm::nosql_index::NosqlIndex::single(field_name, order)
    }
  };

  index = index.name(name);

  if let Some(opts) = options {
    if opts
      .get("unique")
      .and_then(|v| v.as_bool())
      .unwrap_or(false)
    {
      index = index.unique();
    }
    if opts
      .get("sparse")
      .and_then(|v| v.as_bool())
      .unwrap_or(false)
    {
      index = index.sparse();
    }
  }

  Ok(index)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn rebuild_index(
  conn_id: String,
  collection: String,
  index_name: String,
) -> Result<(), String> {
  let timer = DataflowTimer::new("rebuild_index");
  if let Err(e) = validate_conn_id(&conn_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&index_name) {
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

  match dispatch_provider!(entry, conn_id, provider => {
    let indexes = nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, &collection).await.map_err_string()?;
    let index_info = indexes.iter().find(|i| i.name == index_name)
      .ok_or_else(|| format!("Index '{}' not found", index_name))?;
    
    provider.drop_index(&collection, &index_name).await.map_err_string()?;
    
    let fields: Vec<(&str, i32)> = index_info.fields.iter()
      .map(|f: &String| (f.as_str(), 1))
      .collect();
    let rebuild_index = nosql_orm::nosql_index::NosqlIndex::compound(&fields)
      .name(&index_name);
    provider.create_index(&collection, &rebuild_index).await.map_err_string()
  }) {
    Ok(_) => {
      timer.finish_success();
      Ok(())
    }
    Err(e) => {
      timer.clone().finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command(rename_all = "camelCase")]
pub async fn create_index(
  conn_id: String,
  collection: String,
  index_definition: Value,
) -> Result<(), String> {
  let timer = DataflowTimer::new("create_index");
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

  let index = match parse_index_definition(&index_definition) {
    Ok(idx) => idx,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };

  match dispatch_provider!(entry, conn_id, provider => {
    provider.create_index(&collection, &index).await.map_err_string()
  }) {
    Ok(_) => {
      timer.finish_success();
      Ok(())
    }
    Err(e) => {
      timer.clone().finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command(rename_all = "camelCase")]
pub async fn drop_index(
  conn_id: String,
  collection: String,
  index_name: String,
) -> Result<(), String> {
  let timer = DataflowTimer::new("drop_index");
  if let Err(e) = validate_conn_id(&conn_id) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&collection) {
    timer.clone().finish_error(&e);
    return Err(e);
  }
  if let Err(e) = validate_name(&index_name) {
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

  match dispatch_provider!(entry, conn_id, provider => {
    provider.drop_index(&collection, &index_name).await.map_err_string()
  }) {
    Ok(_) => {
      timer.finish_success();
      Ok(())
    }
    Err(e) => {
      timer.clone().finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command(rename_all = "camelCase")]
pub async fn insert_document(
  conn_id: String,
  collection: String,
  data: Value,
) -> Result<Value, String> {
  let timer = DataflowTimer::new("insert_document");
  let params = serde_json::json!({ "conn_id": &conn_id, "collection": &collection, "data": &data });
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
  match dispatch_provider!(entry, conn_id, provider => { provider.insert(&collection, data).await.map_err_string() })
  {
    Ok(result) => {
      timer.finish_success();
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
  match dispatch_provider!(entry, conn_id, provider => { provider.update(&collection, &id, data).await.map_err_string() })
  {
    Ok(result) => {
      timer.finish_success();
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
  match dispatch_provider!(entry, conn_id, provider => { provider.delete(&collection, &id).await.map_err_string() })
  {
    Ok(_) => {
      timer.finish_success();
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
  match dispatch_provider!(entry, conn_id, provider => { provider.update(&collection, &id, deleted_data).await.map_err_string() })
  {
    Ok(_) => {
      timer.finish_success();
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
  match dispatch_provider!(entry, conn_id, provider => {
      provider.begin_transaction().await.map_err_string()
  }) {
    Ok(transaction_id) => {
      let tx_id_str = transaction_id.to_string();
      store_transaction(conn_id.clone(), tx_id_str.clone()).await;
      let result = TransactionResult {
        transaction_id: tx_id_str,
      };
      timer.finish_success();
      Ok(result)
    }
    Err(e) => {
      timer.clone().finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command(rename_all = "camelCase")]
pub async fn commit_transaction(transaction_id: String) -> Result<(), String> {
  let timer = DataflowTimer::new("commit_transaction");
  let conn_id = match get_conn_id_for_transaction(&transaction_id).await {
    Some(id) => id,
    None => {
      timer.clone().finish_error("Transaction not found");
      return Err("Transaction not found".to_string());
    }
  };
  let entry = match get_connection_entry(&conn_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  match dispatch_provider!(entry, conn_id, provider => {
    let tx_id = TransactionId::new(transaction_id.clone());
    provider.commit_transaction(tx_id).await.map_err_string()
  }) {
    Ok(_) => {
      remove_transaction(&transaction_id).await;
      timer.finish_success();
      Ok(())
    }
    Err(e) => {
      timer.clone().finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command(rename_all = "camelCase")]
pub async fn rollback_transaction(transaction_id: String) -> Result<(), String> {
  let timer = DataflowTimer::new("rollback_transaction");
  let conn_id = match get_conn_id_for_transaction(&transaction_id).await {
    Some(id) => id,
    None => {
      timer.clone().finish_error("Transaction not found");
      return Err("Transaction not found".to_string());
    }
  };
  let entry = match get_connection_entry(&conn_id).await {
    Ok(e) => e,
    Err(e) => {
      timer.clone().finish_error(&e);
      return Err(e);
    }
  };
  match dispatch_provider!(entry, conn_id, provider => {
    let tx_id = TransactionId::new(transaction_id.clone());
    provider.rollback_transaction(tx_id).await.map_err_string()
  }) {
    Ok(_) => {
      remove_transaction(&transaction_id).await;
      timer.finish_success();
      Ok(())
    }
    Err(e) => {
      timer.clone().finish_error(&e);
      Err(e)
    }
  }
}
