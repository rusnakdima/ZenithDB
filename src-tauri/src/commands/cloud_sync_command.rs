use crate::models::response::ResponseModel;
use crate::services::cloud_sync_service::CloudSyncService;
use serde_json::Value;

#[tauri::command(rename_all = "camelCase")]
pub async fn sync_schema_to_cloud(
  id: String,
  name: String,
  version: String,
  schema_json: Value,
) -> Result<ResponseModel, String> {
  CloudSyncService::sync_schema_to_cloud(id, name, version, schema_json).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn pull_schema_from_cloud(id: String) -> Result<ResponseModel, String> {
  CloudSyncService::pull_schema_from_cloud(id).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn list_cloud_schemas() -> Result<ResponseModel, String> {
  CloudSyncService::list_cloud_schemas().await
}
