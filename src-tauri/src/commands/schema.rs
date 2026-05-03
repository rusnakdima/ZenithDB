use crate::commands::connection::{store, ConnectionConfigEnum, ConnectionEntry};
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
pub async fn list_collections(conn_id: &str) -> Result<Vec<CollectionMeta>, String> {
    let store = store();
    let store = store.read().await;
    let entry = store
        .find_by_id(conn_id)
        .ok_or_else(|| format!("Connection {} not found", conn_id))?;

    match &entry.config.config {
        ConnectionConfigEnum::Json { path, .. } => {
            let path_obj = std::path::Path::new(path);
            if path_obj.is_dir() {
                let collections: Vec<CollectionMeta> = std::fs::read_dir(path_obj)
                    .map_err(|e| e.to_string())?
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().extension().map_or(false, |ext| ext == "json"))
                    .filter_map(|e| {
                        let name = e
                            .file_name()
                            .into_string()
                            .ok()
                            .map(|n| n.trim_end_matches(".json").to_string())?;
                        Some(CollectionMeta { name, count: 0 })
                    })
                    .collect();
                Ok(collections)
            } else {
                Ok(Vec::new())
            }
        }
        ConnectionConfigEnum::Mongo { uri, database, .. } => {
            let provider = create_mongo_provider(uri, database).await?;
            let collections = provider
                .list_collections()
                .await
                .map_err(|e| e.to_string())?;
            Ok(collections
                .into_iter()
                .map(|c| CollectionMeta {
                    name: c.name,
                    count: c.document_count,
                })
                .collect())
        }
        ConnectionConfigEnum::Redis { uri, .. } => {
            let provider = create_redis_provider(uri).await?;
            let collections = provider
                .list_collections()
                .await
                .map_err(|e| e.to_string())?;
            Ok(collections
                .into_iter()
                .map(|c| CollectionMeta {
                    name: c.name,
                    count: c.document_count,
                })
                .collect())
        }
        ConnectionConfigEnum::Postgres { uri, .. } => {
            let provider = create_postgres_provider(uri).await?;
            let collections = provider
                .list_collections()
                .await
                .map_err(|e| e.to_string())?;
            Ok(collections
                .into_iter()
                .map(|c| CollectionMeta {
                    name: c.name,
                    count: c.document_count,
                })
                .collect())
        }
        ConnectionConfigEnum::Sqlite { path, .. } => {
            let provider = create_sqlite_provider(path).await?;
            let collections = provider
                .list_collections()
                .await
                .map_err(|e| e.to_string())?;
            Ok(collections
                .into_iter()
                .map(|c| CollectionMeta {
                    name: c.name,
                    count: c.document_count,
                })
                .collect())
        }
        ConnectionConfigEnum::MySql { uri, .. } => {
            let provider = create_mysql_provider(uri).await?;
            let collections = provider
                .list_collections()
                .await
                .map_err(|e| e.to_string())?;
            Ok(collections
                .into_iter()
                .map(|c| CollectionMeta {
                    name: c.name,
                    count: c.document_count,
                })
                .collect())
        }
    }
}

#[tauri::command]
pub async fn describe_collection(
    conn_id: &str,
    collection: &str,
) -> Result<CollectionSchema, String> {
    let store = store();
    let store = store.read().await;
    let entry = store
        .find_by_id(conn_id)
        .ok_or_else(|| format!("Connection {} not found", conn_id))?;

    let (schema, indexes) = match &entry.config.config {
        ConnectionConfigEnum::Json { path, .. } => {
            let provider = create_json_provider(path).await?;
            let schema = provider
                .describe_collection(collection)
                .await
                .map_err(|e| e.to_string())?;
            let indexes =
                nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, collection)
                    .await
                    .map_err(|e| e.to_string())?;
            (schema, indexes)
        }
        ConnectionConfigEnum::Mongo { uri, database, .. } => {
            let provider = create_mongo_provider(uri, database).await?;
            let schema = provider
                .describe_collection(collection)
                .await
                .map_err(|e| e.to_string())?;
            let indexes =
                nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, collection)
                    .await
                    .map_err(|e| e.to_string())?;
            (schema, indexes)
        }
        ConnectionConfigEnum::Redis { uri, .. } => {
            let provider = create_redis_provider(uri).await?;
            let schema = provider
                .describe_collection(collection)
                .await
                .map_err(|e| e.to_string())?;
            let indexes =
                nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, collection)
                    .await
                    .map_err(|e| e.to_string())?;
            (schema, indexes)
        }
        ConnectionConfigEnum::Postgres { uri, .. } => {
            let provider = create_postgres_provider(uri).await?;
            let schema = provider
                .describe_collection(collection)
                .await
                .map_err(|e| e.to_string())?;
            let indexes =
                nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, collection)
                    .await
                    .map_err(|e| e.to_string())?;
            (schema, indexes)
        }
        ConnectionConfigEnum::Sqlite { path, .. } => {
            let provider = create_sqlite_provider(path).await?;
            let schema = provider
                .describe_collection(collection)
                .await
                .map_err(|e| e.to_string())?;
            let indexes =
                nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, collection)
                    .await
                    .map_err(|e| e.to_string())?;
            (schema, indexes)
        }
        ConnectionConfigEnum::MySql { uri, .. } => {
            let provider = create_mysql_provider(uri).await?;
            let schema = provider
                .describe_collection(collection)
                .await
                .map_err(|e| e.to_string())?;
            let indexes =
                nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, collection)
                    .await
                    .map_err(|e| e.to_string())?;
            (schema, indexes)
        }
    };

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
    let store = store();
    let store = store.read().await;
    let entry = store
        .find_by_id(conn_id)
        .ok_or_else(|| format!("Connection {} not found", conn_id))?;

    let stats = match &entry.config.config {
        ConnectionConfigEnum::Json { path, .. } => {
            let provider = create_json_provider(path).await?;
            provider
                .get_collection_stats(collection)
                .await
                .map_err(|e| e.to_string())?
        }
        ConnectionConfigEnum::Mongo { uri, database, .. } => {
            let provider = create_mongo_provider(uri, database).await?;
            provider
                .get_collection_stats(collection)
                .await
                .map_err(|e| e.to_string())?
        }
        ConnectionConfigEnum::Redis { uri, .. } => {
            let provider = create_redis_provider(uri).await?;
            provider
                .get_collection_stats(collection)
                .await
                .map_err(|e| e.to_string())?
        }
        ConnectionConfigEnum::Postgres { uri, .. } => {
            let provider = create_postgres_provider(uri).await?;
            provider
                .get_collection_stats(collection)
                .await
                .map_err(|e| e.to_string())?
        }
        ConnectionConfigEnum::Sqlite { path, .. } => {
            let provider = create_sqlite_provider(path).await?;
            provider
                .get_collection_stats(collection)
                .await
                .map_err(|e| e.to_string())?
        }
        ConnectionConfigEnum::MySql { uri, .. } => {
            let provider = create_mysql_provider(uri).await?;
            provider
                .get_collection_stats(collection)
                .await
                .map_err(|e| e.to_string())?
        }
    };

    Ok(CollectionStats {
        name: collection.to_string(),
        document_count: stats.document_count,
        size_bytes: stats.size_bytes,
        index_count: stats.index_count,
    })
}
