use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseMeta {
    pub name: String,
    pub size_bytes: Option<u64>,
    pub table_count: Option<u64>,
}

#[tauri::command]
pub async fn list_databases(conn_id: &str) -> Result<Vec<DatabaseMeta>, String> {
    let entry = get_connection_entry(conn_id).await?;

    match &entry.config.config {
        ConnectionConfigEnum::Json { .. } => {
            Ok(vec![DatabaseMeta {
                name: "default".to_string(),
                size_bytes: None,
                table_count: None,
            }])
        }
        ConnectionConfigEnum::Sqlite { .. } => {
            Ok(vec![DatabaseMeta {
                name: "default".to_string(),
                size_bytes: None,
                table_count: None,
            }])
        }
        ConnectionConfigEnum::Redis { .. } => {
            Ok(vec![DatabaseMeta {
                name: "default".to_string(),
                size_bytes: None,
                table_count: None,
            }])
        }
        ConnectionConfigEnum::Mongo { .. } => {
            Err("MongoDB automatically creates databases when you first insert data. Use the mongo shell to list databases.".to_string())
        }
        ConnectionConfigEnum::Postgres { uri, .. } => {
            let provider = crate::commands::provider::create_postgres_provider(uri).await?;
            let result = provider.execute_raw("SELECT datname FROM pg_database WHERE datistemplate = false", vec![]).await.map_err_string()?;
            let mut dbs = Vec::new();
            for row in result.rows {
                if let Some(name) = row.first().and_then(|v| v.as_str()) {
                    dbs.push(DatabaseMeta {
                        name: name.to_string(),
                        size_bytes: None,
                        table_count: None,
                    });
                }
            }
            Ok(dbs)
        }
        ConnectionConfigEnum::MySql { uri, .. } => {
            let provider = crate::commands::provider::create_mysql_provider(uri).await?;
            let result = provider.execute_raw("SHOW DATABASES", vec![]).await.map_err_string()?;
            let mut dbs = Vec::new();
            for row in result.rows {
                if let Some(name) = row.first().and_then(|v| v.as_str()) {
                    dbs.push(DatabaseMeta {
                        name: name.to_string(),
                        size_bytes: None,
                        table_count: None,
                    });
                }
            }
            Ok(dbs)
        }
    }
}

#[tauri::command]
pub async fn create_database(conn_id: &str, name: &str) -> Result<(), String> {
    let entry = get_connection_entry(conn_id).await?;

    match &entry.config.config {
        ConnectionConfigEnum::Sqlite { .. } => {
            Err("SQLite does not support creating databases. Create a new connection with a different file path.".to_string())
        }
        ConnectionConfigEnum::Json { .. } => {
            Err("JSON provider does not support creating databases.".to_string())
        }
        ConnectionConfigEnum::Redis { .. } => {
            Err("Redis does not support creating databases.".to_string())
        }
        ConnectionConfigEnum::Mongo { .. } => {
            Err("Creating databases is not supported via this interface. Connect to the MongoDB server and use the mongo shell to create databases.".to_string())
        }
        ConnectionConfigEnum::Postgres { uri, .. } => {
            let provider = crate::commands::provider::create_postgres_provider(uri).await?;
            provider.execute_raw(&format!("CREATE DATABASE \"{}\"", name), vec![]).await.map_err_string()?;
            Ok(())
        }
        ConnectionConfigEnum::MySql { uri, .. } => {
            let provider = crate::commands::provider::create_mysql_provider(uri).await?;
            provider.execute_raw(&format!("CREATE DATABASE IF NOT EXISTS `{}`", name), vec![]).await.map_err_string()?;
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn list_collections(conn_id: &str) -> Result<Vec<CollectionMeta>, String> {
    let entry = get_connection_entry(conn_id).await?;

    match &entry.config.config {
        ConnectionConfigEnum::Json { path, .. } => {
            let path_obj = std::path::Path::new(path).to_path_buf();
            if path_obj.is_dir() {
                let collections = list_json_collections(path_obj).await?;
                Ok(collections)
            } else {
                Ok(Vec::new())
            }
        }
        _ => {
            dispatch_provider!(entry, provider => {
                let collections = provider.list_collections().await.map_err_string()?;
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

async fn list_json_collections(
    path_obj: std::path::PathBuf,
) -> Result<Vec<CollectionMeta>, String> {
    let mut entries = tokio::fs::read_dir(&path_obj).await.map_err_string()?;

    let mut collections: Vec<CollectionMeta> = Vec::new();

    while let Some(entry) = entries.next_entry().await.map_err_string()? {
        let file_path = entry.path();
        if file_path.extension().is_some_and(|ext| ext == "json") {
            let name = entry
                .file_name()
                .into_string()
                .ok()
                .map(|n| n.trim_end_matches(".json").to_string());

            if let Some(name) = name {
                let count = tokio::fs::read_to_string(&file_path)
                    .await
                    .ok()
                    .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
                    .map(|v| {
                        if let Some(arr) = v.as_array() {
                            arr.len() as u64
                        } else {
                            1
                        }
                    })
                    .unwrap_or(0);

                collections.push(CollectionMeta { name, count });
            }
        }
    }

    Ok(collections)
}

#[tauri::command]
pub async fn describe_collection(
    conn_id: &str,
    collection: &str,
) -> Result<CollectionSchema, String> {
    let entry = get_connection_entry(conn_id).await?;

    let (schema, indexes) = dispatch_provider!(entry, provider => {
        let schema = provider.describe_collection(collection).await.map_err_string()?;
        let indexes = nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, collection)
            .await
            .map_err_string()?;
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
        provider.get_collection_stats(collection).await.map_err_string()
    })?;

    Ok(CollectionStats {
        name: collection.to_string(),
        document_count: stats.document_count,
        size_bytes: stats.size_bytes,
        index_count: stats.index_count,
    })
}
