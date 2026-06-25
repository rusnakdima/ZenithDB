use crate::commands::error_utils::ToStringError;
use crate::commands::provider::create_mongo_provider;
use crate::models::response::Response;
use chrono::{DateTime, Utc};
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

const CLOUD_MONGO_URI: &str = "mongodb://localhost:27017";
const CLOUD_DATABASE: &str = "designer";
const SCHEMAS_COLLECTION: &str = "schemas";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudSchema {
  pub id: String,
  pub name: String,
  pub version: String,
  pub schema_json: Value,
  pub created_at: DateTime<Utc>,
  pub updated_at: DateTime<Utc>,
}

pub struct CloudSyncService;

impl CloudSyncService {
  pub async fn sync_schema_to_cloud(
    id: String,
    name: String,
    version: String,
    schema_json: Value,
  ) -> Result<Response, String> {
    let provider = create_mongo_provider(CLOUD_MONGO_URI, CLOUD_DATABASE)
      .await
      .map_err(|e| format!("Failed to connect to cloud database: {}", e))?;

    let now = Utc::now();
    let cloud_schema = CloudSchema {
      id: id.clone(),
      name: name.clone(),
      version: version.clone(),
      schema_json: schema_json.clone(),
      created_at: now,
      updated_at: now,
    };

    let filter_json = serde_json::json!({ "id": { "$eq": &id } });
    let filter = Filter::from_json(&filter_json).map_err_string()?;
    let existing_count = provider
      .count(SCHEMAS_COLLECTION, Some(&filter))
      .await
      .map_err_string()?;

    if existing_count > 0 {
      let update_data = serde_json::json!({
          "name": name,
          "version": version,
          "schemaJson": schema_json,
          "updatedAt": now.to_rfc3339(),
      });
      provider
        .update(SCHEMAS_COLLECTION, &id, update_data)
        .await
        .map_err_string()?;
      Ok(Response::updated("Schema updated in cloud", Value::Null))
    } else {
      let insert_data = serde_json::to_value(&cloud_schema).map_err_string()?;
      provider
        .insert(SCHEMAS_COLLECTION, insert_data)
        .await
        .map_err_string()?;
      Ok(Response::created("Schema synced to cloud", Value::Null))
    }
  }

  pub async fn pull_schema_from_cloud(id: String) -> Result<Response, String> {
    let provider = create_mongo_provider(CLOUD_MONGO_URI, CLOUD_DATABASE)
      .await
      .map_err(|e| format!("Failed to connect to cloud database: {}", e))?;

    let filter_json = serde_json::json!({ "id": { "$eq": &id } });
    let filter = Filter::from_json(&filter_json).map_err_string()?;
    let results = provider
      .find_many(SCHEMAS_COLLECTION, Some(&filter), None, None, None, true)
      .await
      .map_err_string()?;

    let schema = results
      .into_iter()
      .next()
      .ok_or_else(|| "Schema not found in cloud".to_string())?;

    Ok(Response::success("Schema pulled from cloud", schema))
  }

  pub async fn list_cloud_schemas() -> Result<Response, String> {
    let provider = create_mongo_provider(CLOUD_MONGO_URI, CLOUD_DATABASE)
      .await
      .map_err(|e| format!("Failed to connect to cloud database: {}", e))?;

    let schemas = provider
      .find_many(SCHEMAS_COLLECTION, None, None, None, None, true)
      .await
      .map_err_string()?;

    Ok(Response::success(
      "Cloud schemas listed",
      Value::Array(schemas),
    ))
  }
}
