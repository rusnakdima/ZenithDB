use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::get_connection_entry;
use crate::dispatch_provider;
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<Value>>,
    pub affected_rows: u64,
}

#[tauri::command]
pub async fn create_collection(conn_id: &str, name: &str) -> Result<(), String> {
    let entry = get_connection_entry(conn_id).await?;
    dispatch_provider!(entry, provider => {
        provider.create_collection(name, None).await.map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub async fn drop_collection(conn_id: &str, name: &str) -> Result<(), String> {
    let entry = get_connection_entry(conn_id).await?;
    dispatch_provider!(entry, provider => {
        provider.drop_collection(name).await.map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub async fn execute_raw(conn_id: &str, sql: &str) -> Result<RawResult, String> {
    let entry = get_connection_entry(conn_id).await?;
    dispatch_provider!(entry, provider => {
        let result = provider.execute_raw(sql, vec![]).await.map_err(|e| e.to_string())?;
        Ok(RawResult {
            columns: result.columns,
            rows: result.rows,
            affected_rows: result.affected_rows,
        })
    })
}

#[tauri::command]
pub async fn get_server_version(conn_id: &str) -> Result<String, String> {
    let entry = get_connection_entry(conn_id).await?;
    match &entry.config.config {
        ConnectionConfigEnum::Json { .. } => Ok("JSON Provider (local file)".to_string()),
        ConnectionConfigEnum::Mongo { .. } => Ok("MongoDB".to_string()),
        ConnectionConfigEnum::Redis { .. } => Ok("Redis".to_string()),
        ConnectionConfigEnum::Postgres { uri, .. } => {
            let provider = crate::commands::provider::create_postgres_provider(uri).await?;
            provider
                .get_server_version()
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::Sqlite { .. } => Ok("SQLite".to_string()),
        ConnectionConfigEnum::MySql { uri, .. } => {
            let provider = crate::commands::provider::create_mysql_provider(uri).await?;
            provider
                .get_server_version()
                .await
                .map_err(|e| e.to_string())
        }
    }
}
