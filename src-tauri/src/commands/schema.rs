use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::get_connection_entry;
use crate::dispatch_provider;
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionMeta {
    pub name: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub is_primary_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexInfo {
    pub name: String,
    pub columns: Vec<String>,
    pub is_unique: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionSchema {
    pub name: String,
    pub columns: Vec<ColumnInfo>,
    pub indexes: Vec<IndexInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionStats {
    pub name: String,
    pub document_count: u64,
    pub size_bytes: u64,
    pub index_count: u64,
}

#[tauri::command]
pub async fn list_collections(conn_id: &str) -> Result<Vec<CollectionMeta>, String> {
    let entry = get_connection_entry(conn_id).await?;

    match &entry.config.config {
        ConnectionConfigEnum::Json { path, .. } => {
            let path_obj = std::path::Path::new(path);
            if path_obj.is_dir() {
                let collections: Vec<CollectionMeta> = std::fs::read_dir(path_obj)
                    .map_err(|e| e.to_string())?
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().extension().map_or(false, |ext| ext == "json"))
                    .filter_map(|e| {
                        let file_path = e.path();
                        let name = e
                            .file_name()
                            .into_string()
                            .ok()
                            .map(|n| n.trim_end_matches(".json").to_string())?;
                        let count = std::fs::read_to_string(&file_path)
                            .ok()
                            .and_then(|content| {
                                serde_json::from_str::<serde_json::Value>(&content).ok()
                            })
                            .map(|v| {
                                if let Some(arr) = v.as_array() {
                                    arr.len() as u64
                                } else {
                                    1
                                }
                            })
                            .unwrap_or(0);
                        Some(CollectionMeta { name, count })
                    })
                    .collect();
                Ok(collections)
            } else {
                Ok(Vec::new())
            }
        }
        _ => {
            dispatch_provider!(entry, provider => {
                let collections = provider.list_collections().await.map_err(|e| e.to_string())?;
                Ok(collections
                    .into_iter()
                    .map(|c| CollectionMeta {
                        name: c.name,
                        count: c.document_count,
                    })
                    .collect())
            })
        }
    }
}

#[tauri::command]
pub async fn describe_collection(
    conn_id: &str,
    collection: &str,
) -> Result<CollectionSchema, String> {
    let entry = get_connection_entry(conn_id).await?;

    let (schema, indexes) = dispatch_provider!(entry, provider => {
        let schema = provider.describe_collection(collection).await.map_err(|e| e.to_string())?;
        let indexes = nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, collection)
            .await
            .map_err(|e| e.to_string())?;
        Ok::<_, String>((schema, indexes))
    })?;

    let columns: Vec<ColumnInfo> = schema
        .fields
        .iter()
        .map(|(name, field)| ColumnInfo {
            name: name.clone(),
            data_type: field.field_type.clone(),
            nullable: field.nullable,
            is_primary_key: false,
        })
        .collect();

    let index_infos: Vec<IndexInfo> = indexes
        .into_iter()
        .map(|idx| IndexInfo {
            name: idx.name,
            columns: idx.fields,
            is_unique: idx.unique,
        })
        .collect();

    Ok(CollectionSchema {
        name: collection.to_string(),
        columns,
        indexes: index_infos,
    })
}

#[tauri::command]
pub async fn get_collection_stats(
    conn_id: &str,
    collection: &str,
) -> Result<CollectionStats, String> {
    let entry = get_connection_entry(conn_id).await?;

    let stats = dispatch_provider!(entry, provider => {
        provider.get_collection_stats(collection).await.map_err(|e| e.to_string())
    })?;

    Ok(CollectionStats {
        name: collection.to_string(),
        document_count: stats.document_count,
        size_bytes: stats.size_bytes,
        index_count: stats.index_count,
    })
}
