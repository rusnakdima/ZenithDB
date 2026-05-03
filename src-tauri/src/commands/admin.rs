use crate::commands::connection::{store, ConnectionConfigEnum, ConnectionEntry};
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<Value>>,
    pub affected_rows: u64,
}

async fn create_json_provider(path: &str) -> Result<nosql_orm::providers::JsonProvider, String> {
    nosql_orm::providers::JsonProvider::new(path)
        .await
        .map_err(|e| e.to_string())
}

async fn create_mongo_provider(
    uri: &str,
    database: &str,
) -> Result<nosql_orm::providers::MongoProvider, String> {
    nosql_orm::providers::MongoProvider::connect(uri, database)
        .await
        .map_err(|e| e.to_string())
}

async fn create_redis_provider(uri: &str) -> Result<nosql_orm::providers::RedisProvider, String> {
    nosql_orm::providers::RedisProvider::new(uri)
        .await
        .map_err(|e| e.to_string())
}

async fn create_postgres_provider(
    uri: &str,
) -> Result<nosql_orm::providers::sql::PostgresProvider, String> {
    nosql_orm::providers::sql::PostgresProvider::connect(uri)
        .await
        .map_err(|e| e.to_string())
}

async fn create_sqlite_provider(
    path: &str,
) -> Result<nosql_orm::providers::sql::SqliteProvider, String> {
    nosql_orm::providers::sql::SqliteProvider::connect(path)
        .await
        .map_err(|e| e.to_string())
}

async fn create_mysql_provider(
    uri: &str,
) -> Result<nosql_orm::providers::sql::MySqlProvider, String> {
    nosql_orm::providers::sql::MySqlProvider::connect(uri)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_collection(conn_id: &str, name: &str) -> Result<(), String> {
    let store = store();
    let store = store.read().await;
    let entry = store
        .find_by_id(conn_id)
        .ok_or_else(|| format!("Connection {} not found", conn_id))?;

    match &entry.config.config {
        ConnectionConfigEnum::Json { path, .. } => {
            let provider = create_json_provider(path).await?;
            provider
                .create_collection(name, None)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::Mongo { uri, database, .. } => {
            let provider = create_mongo_provider(uri, database).await?;
            provider
                .create_collection(name, None)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::Redis { uri, .. } => {
            let provider = create_redis_provider(uri).await?;
            provider
                .create_collection(name, None)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::Postgres { uri, .. } => {
            let provider = create_postgres_provider(uri).await?;
            provider
                .create_collection(name, None)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::Sqlite { path, .. } => {
            let provider = create_sqlite_provider(path).await?;
            provider
                .create_collection(name, None)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::MySql { uri, .. } => {
            let provider = create_mysql_provider(uri).await?;
            provider
                .create_collection(name, None)
                .await
                .map_err(|e| e.to_string())
        }
    }
}

#[tauri::command]
pub async fn drop_collection(conn_id: &str, name: &str) -> Result<(), String> {
    let store = store();
    let store = store.read().await;
    let entry = store
        .find_by_id(conn_id)
        .ok_or_else(|| format!("Connection {} not found", conn_id))?;

    match &entry.config.config {
        ConnectionConfigEnum::Json { path, .. } => {
            let provider = create_json_provider(path).await?;
            provider
                .drop_collection(name)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::Mongo { uri, database, .. } => {
            let provider = create_mongo_provider(uri, database).await?;
            provider
                .drop_collection(name)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::Redis { uri, .. } => {
            let provider = create_redis_provider(uri).await?;
            provider
                .drop_collection(name)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::Postgres { uri, .. } => {
            let provider = create_postgres_provider(uri).await?;
            provider
                .drop_collection(name)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::Sqlite { path, .. } => {
            let provider = create_sqlite_provider(path).await?;
            provider
                .drop_collection(name)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::MySql { uri, .. } => {
            let provider = create_mysql_provider(uri).await?;
            provider
                .drop_collection(name)
                .await
                .map_err(|e| e.to_string())
        }
    }
}

#[tauri::command]
pub async fn execute_raw(conn_id: &str, sql: &str) -> Result<RawResult, String> {
    let store = store();
    let store = store.read().await;
    let entry = store
        .find_by_id(conn_id)
        .ok_or_else(|| format!("Connection {} not found", conn_id))?;

    match &entry.config.config {
        ConnectionConfigEnum::Json { path, .. } => {
            let provider = create_json_provider(path).await?;
            let result = provider
                .execute_raw(sql, vec![])
                .await
                .map_err(|e| e.to_string())?;
            Ok(RawResult {
                columns: result.columns,
                rows: result.rows,
                affected_rows: result.affected_rows,
            })
        }
        ConnectionConfigEnum::Mongo { uri, database, .. } => {
            let provider = create_mongo_provider(uri, database).await?;
            let result = provider
                .execute_raw(sql, vec![])
                .await
                .map_err(|e| e.to_string())?;
            Ok(RawResult {
                columns: result.columns,
                rows: result.rows,
                affected_rows: result.affected_rows,
            })
        }
        ConnectionConfigEnum::Redis { uri, .. } => {
            let provider = create_redis_provider(uri).await?;
            let result = provider
                .execute_raw(sql, vec![])
                .await
                .map_err(|e| e.to_string())?;
            Ok(RawResult {
                columns: result.columns,
                rows: result.rows,
                affected_rows: result.affected_rows,
            })
        }
        ConnectionConfigEnum::Postgres { uri, .. } => {
            let provider = create_postgres_provider(uri).await?;
            let result = provider
                .execute_raw(sql, vec![])
                .await
                .map_err(|e| e.to_string())?;
            Ok(RawResult {
                columns: result.columns,
                rows: result.rows,
                affected_rows: result.affected_rows,
            })
        }
        ConnectionConfigEnum::Sqlite { path, .. } => {
            let provider = create_sqlite_provider(path).await?;
            let result = provider
                .execute_raw(sql, vec![])
                .await
                .map_err(|e| e.to_string())?;
            Ok(RawResult {
                columns: result.columns,
                rows: result.rows,
                affected_rows: result.affected_rows,
            })
        }
        ConnectionConfigEnum::MySql { uri, .. } => {
            let provider = create_mysql_provider(uri).await?;
            let result = provider
                .execute_raw(sql, vec![])
                .await
                .map_err(|e| e.to_string())?;
            Ok(RawResult {
                columns: result.columns,
                rows: result.rows,
                affected_rows: result.affected_rows,
            })
        }
    }
}

#[tauri::command]
pub async fn get_server_version(conn_id: &str) -> Result<String, String> {
    let store = store();
    let store = store.read().await;
    let entry = store
        .find_by_id(conn_id)
        .ok_or_else(|| format!("Connection {} not found", conn_id))?;

    match &entry.config.config {
        ConnectionConfigEnum::Json { .. } => Ok("JSON Provider (local file)".to_string()),
        ConnectionConfigEnum::Mongo { .. } => Ok("MongoDB".to_string()),
        ConnectionConfigEnum::Redis { .. } => Ok("Redis".to_string()),
        ConnectionConfigEnum::Postgres { uri, .. } => {
            let provider = create_postgres_provider(uri).await?;
            provider
                .get_server_version()
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::Sqlite { .. } => Ok("SQLite".to_string()),
        ConnectionConfigEnum::MySql { uri, .. } => {
            let provider = create_mysql_provider(uri).await?;
            provider
                .get_server_version()
                .await
                .map_err(|e| e.to_string())
        }
    }
}
