use crate::commands::connection::{store, ConnectionConfigEnum, ConnectionEntry};
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryParams {
    pub filter: Option<Value>,
    pub order_by: Option<String>,
    pub direction: Option<String>,
    pub skip: Option<u64>,
    pub limit: Option<u64>,
    pub select: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub data: Vec<Value>,
    pub total: u64,
    pub has_more: bool,
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

fn parse_filter(filter_val: Option<Value>) -> Result<Option<Filter>, String> {
    match filter_val {
        Some(val) => Filter::from_json(&val).map_err(|e| e.to_string()).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn query_data(
    conn_id: &str,
    collection: &str,
    query: QueryParams,
) -> Result<QueryResult, String> {
    let store = store();
    let store = store.read().await;
    let entry = store
        .find_by_id(conn_id)
        .ok_or_else(|| format!("Connection {} not found", conn_id))?;

    let filter = parse_filter(query.filter)?;
    let skip = query.skip;
    let limit = query.limit;
    let sort_by = query.order_by.as_deref();
    let sort_asc = query.direction.as_deref() != Some("desc");

    let (data, total) = match &entry.config.config {
        ConnectionConfigEnum::Json { path, .. } => {
            let provider = create_json_provider(path).await?;
            let total = provider
                .count(collection, filter.as_ref())
                .await
                .map_err(|e| e.to_string())?;
            let data = provider
                .find_many(collection, filter.as_ref(), skip, limit, sort_by, sort_asc)
                .await
                .map_err(|e| e.to_string())?;
            (data, total)
        }
        ConnectionConfigEnum::Mongo { uri, database, .. } => {
            let provider = create_mongo_provider(uri, database).await?;
            let total = provider
                .count(collection, filter.as_ref())
                .await
                .map_err(|e| e.to_string())?;
            let data = provider
                .find_many(collection, filter.as_ref(), skip, limit, sort_by, sort_asc)
                .await
                .map_err(|e| e.to_string())?;
            (data, total)
        }
        ConnectionConfigEnum::Redis { uri, .. } => {
            let provider = create_redis_provider(uri).await?;
            let total = provider
                .count(collection, filter.as_ref())
                .await
                .map_err(|e| e.to_string())?;
            let data = provider
                .find_many(collection, filter.as_ref(), skip, limit, sort_by, sort_asc)
                .await
                .map_err(|e| e.to_string())?;
            (data, total)
        }
        ConnectionConfigEnum::Postgres { uri, .. } => {
            let provider = create_postgres_provider(uri).await?;
            let total = provider
                .count(collection, filter.as_ref())
                .await
                .map_err(|e| e.to_string())?;
            let data = provider
                .find_many(collection, filter.as_ref(), skip, limit, sort_by, sort_asc)
                .await
                .map_err(|e| e.to_string())?;
            (data, total)
        }
        ConnectionConfigEnum::Sqlite { path, .. } => {
            let provider = create_sqlite_provider(path).await?;
            let total = provider
                .count(collection, filter.as_ref())
                .await
                .map_err(|e| e.to_string())?;
            let data = provider
                .find_many(collection, filter.as_ref(), skip, limit, sort_by, sort_asc)
                .await
                .map_err(|e| e.to_string())?;
            (data, total)
        }
        ConnectionConfigEnum::MySql { uri, .. } => {
            let provider = create_mysql_provider(uri).await?;
            let total = provider
                .count(collection, filter.as_ref())
                .await
                .map_err(|e| e.to_string())?;
            let data = provider
                .find_many(collection, filter.as_ref(), skip, limit, sort_by, sort_asc)
                .await
                .map_err(|e| e.to_string())?;
            (data, total)
        }
    };

    let has_more = if let (Some(skip), Some(limit)) = (skip, limit) {
        data.len() as u64 >= limit
    } else {
        false
    };

    Ok(QueryResult {
        data,
        total,
        has_more,
    })
}

#[tauri::command]
pub async fn save_row(conn_id: &str, collection: &str, data: Value) -> Result<Value, String> {
    let store = store();
    let store = store.read().await;
    let entry = store
        .find_by_id(conn_id)
        .ok_or_else(|| format!("Connection {} not found", conn_id))?;

    match &entry.config.config {
        ConnectionConfigEnum::Json { path, .. } => {
            let provider = create_json_provider(path).await?;
            if let Some(id) = data.get("id").and_then(|v| v.as_str()) {
                if provider
                    .exists(collection, id)
                    .await
                    .map_err(|e| e.to_string())?
                {
                    return provider
                        .update(collection, id, data.clone())
                        .await
                        .map_err(|e| e.to_string());
                }
            }
            provider
                .insert(collection, data)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::Mongo { uri, database, .. } => {
            let provider = create_mongo_provider(uri, database).await?;
            if let Some(id) = data.get("id").and_then(|v| v.as_str()) {
                if provider
                    .exists(collection, id)
                    .await
                    .map_err(|e| e.to_string())?
                {
                    return provider
                        .update(collection, id, data.clone())
                        .await
                        .map_err(|e| e.to_string());
                }
            }
            provider
                .insert(collection, data)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::Redis { uri, .. } => {
            let provider = create_redis_provider(uri).await?;
            if let Some(id) = data.get("id").and_then(|v| v.as_str()) {
                if provider
                    .exists(collection, id)
                    .await
                    .map_err(|e| e.to_string())?
                {
                    return provider
                        .update(collection, id, data.clone())
                        .await
                        .map_err(|e| e.to_string());
                }
            }
            provider
                .insert(collection, data)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::Postgres { uri, .. } => {
            let provider = create_postgres_provider(uri).await?;
            if let Some(id) = data.get("id").and_then(|v| v.as_str()) {
                if provider
                    .exists(collection, id)
                    .await
                    .map_err(|e| e.to_string())?
                {
                    return provider
                        .update(collection, id, data.clone())
                        .await
                        .map_err(|e| e.to_string());
                }
            }
            provider
                .insert(collection, data)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::Sqlite { path, .. } => {
            let provider = create_sqlite_provider(path).await?;
            if let Some(id) = data.get("id").and_then(|v| v.as_str()) {
                if provider
                    .exists(collection, id)
                    .await
                    .map_err(|e| e.to_string())?
                {
                    return provider
                        .update(collection, id, data.clone())
                        .await
                        .map_err(|e| e.to_string());
                }
            }
            provider
                .insert(collection, data)
                .await
                .map_err(|e| e.to_string())
        }
        ConnectionConfigEnum::MySql { uri, .. } => {
            let provider = create_mysql_provider(uri).await?;
            if let Some(id) = data.get("id").and_then(|v| v.as_str()) {
                if provider
                    .exists(collection, id)
                    .await
                    .map_err(|e| e.to_string())?
                {
                    return provider
                        .update(collection, id, data.clone())
                        .await
                        .map_err(|e| e.to_string());
                }
            }
            provider
                .insert(collection, data)
                .await
                .map_err(|e| e.to_string())
        }
    }
}

#[tauri::command]
pub async fn delete_row(conn_id: &str, collection: &str, id: &str) -> Result<(), String> {
    let store = store();
    let store = store.read().await;
    let entry = store
        .find_by_id(conn_id)
        .ok_or_else(|| format!("Connection {} not found", conn_id))?;

    match &entry.config.config {
        ConnectionConfigEnum::Json { path, .. } => {
            let provider = create_json_provider(path).await?;
            provider
                .delete(collection, id)
                .await
                .map_err(|e| e.to_string())?;
        }
        ConnectionConfigEnum::Mongo { uri, database, .. } => {
            let provider = create_mongo_provider(uri, database).await?;
            provider
                .delete(collection, id)
                .await
                .map_err(|e| e.to_string())?;
        }
        ConnectionConfigEnum::Redis { uri, .. } => {
            let provider = create_redis_provider(uri).await?;
            provider
                .delete(collection, id)
                .await
                .map_err(|e| e.to_string())?;
        }
        ConnectionConfigEnum::Postgres { uri, .. } => {
            let provider = create_postgres_provider(uri).await?;
            provider
                .delete(collection, id)
                .await
                .map_err(|e| e.to_string())?;
        }
        ConnectionConfigEnum::Sqlite { path, .. } => {
            let provider = create_sqlite_provider(path).await?;
            provider
                .delete(collection, id)
                .await
                .map_err(|e| e.to_string())?;
        }
        ConnectionConfigEnum::MySql { uri, .. } => {
            let provider = create_mysql_provider(uri).await?;
            provider
                .delete(collection, id)
                .await
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
