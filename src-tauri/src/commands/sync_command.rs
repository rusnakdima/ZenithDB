use crate::models::response::ResponseModel;
use crate::services::sync_service::SyncService;

#[tauri::command(rename_all = "camelCase")]
pub async fn pull_schema(
  mongo_uri: String,
  database_name: String,
  collection_name: String,
  schema_id: String,
) -> Result<ResponseModel, String> {
  SyncService::pull_from_cloud(&mongo_uri, &database_name, &collection_name, &schema_id).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_cached_schema(app_id: String) -> Result<ResponseModel, String> {
  SyncService::get_cached_schema(&app_id).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn clear_schema_cache(app_id: String) -> Result<ResponseModel, String> {
  SyncService::clear_cache(&app_id).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn save_to_local_cache(
  app_id: String,
  schema: serde_json::Value,
) -> Result<ResponseModel, String> {
  SyncService::save_to_local_cache(&app_id, schema).await
}
