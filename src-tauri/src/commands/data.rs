use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::get_connection_entry;
use crate::dispatch_provider;
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub data: Vec<Value>,
    pub total: u64,
    pub has_more: bool,
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
    let entry = get_connection_entry(conn_id).await?;
    let filter = parse_filter(query.filter)?;
    let skip = query.skip;
    let limit = query.limit;
    let sort_by = query.order_by.as_deref();
    let sort_asc = query.direction.as_deref() != Some("desc");

    let (data, total) = dispatch_provider!(entry, provider => {
        let total = provider.count(collection, filter.as_ref()).await.map_err(|e| e.to_string())?;
        let data = provider
            .find_many(collection, filter.as_ref(), skip, limit, sort_by, sort_asc)
            .await
            .map_err(|e| e.to_string())?;
        Ok::<_, String>((data, total))
    })?;

    let has_more = if let (Some(_skip), Some(limit)) = (skip, limit) {
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
    let entry = get_connection_entry(conn_id).await?;
    dispatch_provider!(entry, provider => {
        if let Some(id) = data.get("id").and_then(|v| v.as_str()) {
            if provider.exists(collection, id).await.map_err(|e| e.to_string())? {
                return provider.update(collection, id, data.clone()).await.map_err(|e| e.to_string());
            }
        }
        provider.insert(collection, data).await.map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub async fn delete_row(conn_id: &str, collection: &str, id: &str) -> Result<(), String> {
    let entry = get_connection_entry(conn_id).await?;
    dispatch_provider!(entry, provider => {
        provider.delete(collection, id).await.map_err(|e| e.to_string())?;
        Ok(())
    })
}
