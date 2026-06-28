use crate::commands::error_utils::ToStringError;
use crate::commands::provider::create_mongo_provider;
use crate::models::response::{created, success, updated, ResponseModel};
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;

const SCHEMAS_COLLECTION: &str = "schemas";

fn get_cache_path() -> PathBuf {
  let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
  path.push("ZenithDB");
  path.push("schema_cache");
  path
}

async fn get_or_create_local_provider() -> Result<JsonProvider, String> {
  let cache_path = get_cache_path();
  std::fs::create_dir_all(&cache_path).map_err(|e| format!("Failed to create cache dir: {}", e))?;
  JsonProvider::new(cache_path.to_str().unwrap())
    .await
    .map_err(|e| format!("Failed to create local provider: {}", e))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedSchema {
  pub id: String,
  pub app_id: String,
  pub schema: Value,
  pub cached_at: i64,
}

pub struct SyncService;

impl SyncService {
  pub async fn pull_from_cloud(
    mongo_uri: &str,
    database_name: &str,
    collection_name: &str,
    schema_id: &str,
  ) -> Result<ResponseModel, String> {
    let provider = create_mongo_provider(mongo_uri, database_name)
      .await
      .map_err(|e| format!("Failed to connect to MongoDB: {}", e))?;

    let filter_json = serde_json::json!({ "id": { "$eq": schema_id } });
    let filter = Filter::from_json(&filter_json).map_err_string()?;
    let results = provider
      .find_many(collection_name, Some(&filter), None, None, None, true)
      .await
      .map_err_string()?;

    let schema = results
      .into_iter()
      .next()
      .ok_or_else(|| "Schema not found in cloud".to_string())?;

    Ok(success("Schema pulled from cloud", schema))
  }

  pub async fn save_to_local_cache(app_id: &str, schema: Value) -> Result<ResponseModel, String> {
    let provider = get_or_create_local_provider().await?;
    let cached = CachedSchema {
      id: app_id.to_string(),
      app_id: app_id.to_string(),
      schema,
      cached_at: chrono::Utc::now().timestamp_millis(),
    };
    let doc = serde_json::to_value(&cached).map_err(|e| format!("Serialization failed: {}", e))?;
    let _: Value = provider
      .insert(SCHEMAS_COLLECTION, doc)
      .await
      .map_err(|e| format!("Failed to save to local cache: {}", e))?;
    Ok(created("Schema cached locally", Value::Null))
  }

  pub async fn get_cached_schema(app_id: &str) -> Result<ResponseModel, String> {
    let provider = get_or_create_local_provider().await?;
    let doc_result = provider.find_by_id(SCHEMAS_COLLECTION, app_id).await;
    match doc_result {
      Ok(Some(value)) => {
        let cached: CachedSchema =
          serde_json::from_value(value).map_err(|e| format!("Deserialization failed: {}", e))?;
        Ok(success("Schema retrieved from cache", cached.schema))
      }
      Ok(None) => Err("Schema not found in local cache".to_string()),
      Err(e) => Err(format!("Failed to get local cache: {}", e)),
    }
  }

  pub async fn clear_cache(app_id: &str) -> Result<ResponseModel, String> {
    let provider = get_or_create_local_provider().await?;
    let _: bool = provider
      .delete(SCHEMAS_COLLECTION, app_id)
      .await
      .map_err(|e| format!("Failed to delete from local cache: {}", e))?;
    Ok(updated("Schema cache cleared", Value::Null))
  }
}
