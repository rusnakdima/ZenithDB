use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_auth_context;
use crate::commands::get_connection_entry;
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::dispatch_provider;
use crate::dispatch_provider_cached;
use crate::infrastructure::nosql_orm_adapter::NosqlOrmAdapter;
use nosql_orm::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

fn validate_safe_path(base: &str, user_input: &str) -> Result<PathBuf, String> {
  crate::infrastructure::nosql_orm_adapter::validate_safe_path(base, user_input)
}

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

impl DatabaseMeta {
  fn from_name(name: &str) -> Self {
    Self {
      name: name.to_string(),
      size_bytes: None,
      table_count: None,
    }
  }
}

fn parse_database_rows(rows: &[Vec<serde_json::Value>]) -> Vec<DatabaseMeta> {
  let mut dbs = Vec::new();
  for row in rows {
    if let Some(name) = row.first().and_then(|v| v.as_str()) {
      dbs.push(DatabaseMeta::from_name(name));
    }
  }
  dbs
}

#[tauri::command]
pub async fn list_databases(connId: &str) -> Result<Vec<DatabaseMeta>, String> {
  validate_conn_id(connId)?;
  let entry = get_connection_entry(connId).await?;

  match &entry.config.config {
    ConnectionConfigEnum::Json { path, .. } => {
      let provider = NosqlOrmAdapter::create_provider(&entry.config.config).await?;
      let databases = provider.list_databases().await?;
      Ok(databases)
    }
    ConnectionConfigEnum::Sqlite { path, .. } => {
      let db_name = std::path::Path::new(path)
        .file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("database")
        .to_string();
      Ok(vec![DatabaseMeta::from_name(&db_name)])
    }
    ConnectionConfigEnum::Redis { .. } => Ok(vec![DatabaseMeta::from_name("default")]),
    ConnectionConfigEnum::Mongo { uri, .. } => {
      let provider =
        crate::commands::provider::get_or_create_mongo_provider(connId, uri, "admin").await?;
      let result = provider
        .execute_raw("listDatabases", vec![])
        .await
        .map_err_string()?;
      let mut dbs = Vec::new();
      for row in result.rows {
        if let Some(doc) = row.get(0).and_then(|v| v.as_object()) {
          if let Some(name) = doc.get("name").and_then(|v| v.as_str()) {
            dbs.push(DatabaseMeta {
              name: name.to_string(),
              size_bytes: None,
              table_count: None,
            });
          }
        }
      }
      Ok(dbs)
    }
    ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider =
        crate::commands::provider::get_or_create_postgres_provider(connId, uri).await?;
      let result = provider
        .execute_raw(
          "SELECT datname FROM pg_database WHERE datistemplate = false",
          vec![],
        )
        .await
        .map_err_string()?;
      Ok(parse_database_rows(&result.rows))
    }
    ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::get_or_create_mysql_provider(connId, uri).await?;
      let result = provider
        .execute_raw("SHOW DATABASES", vec![])
        .await
        .map_err_string()?;
      Ok(parse_database_rows(&result.rows))
    }
  }
}

#[tauri::command]
pub async fn create_database(connId: &str, name: &str) -> Result<(), String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(connId) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(connId)?;
  validate_name(name)?;
  let entry = get_connection_entry(connId).await?;

  match &entry.config.config {
    ConnectionConfigEnum::Sqlite { path, .. } => {
      if !std::path::Path::new(path).exists() {
        tokio::fs::File::create(path).await.map_err_string()?;
      }
      Ok(())
    }
    ConnectionConfigEnum::Json { path, .. } => {
      NosqlOrmAdapter::create_database_json(path, name).await
    }
    ConnectionConfigEnum::Redis { .. } => Ok(()),
    ConnectionConfigEnum::Mongo { uri, .. } => {
      let provider = crate::commands::provider::create_mongo_provider(uri, &name).await?;
      provider
        .execute_raw("create", vec![])
        .await
        .map_err_string()?;
      Ok(())
    }
    ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri).await?;
      provider
        .execute_raw(&format!("CREATE DATABASE \"{}\"", name), vec![])
        .await
        .map_err_string()?;
      Ok(())
    }
    ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::create_mysql_provider(uri).await?;
      provider
        .execute_raw(&format!("CREATE DATABASE IF NOT EXISTS `{}`", name), vec![])
        .await
        .map_err_string()?;
      Ok(())
    }
  }
}

#[tauri::command]
pub async fn rename_database(connId: &str, oldName: &str, newName: &str) -> Result<(), String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(connId) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(connId)?;
  validate_name(oldName)?;
  validate_name(newName)?;
  let entry = get_connection_entry(connId).await?;

  match &entry.config.config {
    ConnectionConfigEnum::Sqlite { .. } => Err(
      "SQLite database cannot be renamed. Create a new connection with a different file path."
        .to_string(),
    ),
    ConnectionConfigEnum::Json { path, .. } => {
      let old_path = validate_safe_path(path, oldName)?;
      let new_path = validate_safe_path(path, newName)?;
      if old_path.exists() {
        tokio::fs::rename(&old_path, &new_path)
          .await
          .map_err_string()?;
      }
      Ok(())
    }
    ConnectionConfigEnum::Redis { .. } => {
      Err("Redis does not support renaming databases.".to_string())
    }
    ConnectionConfigEnum::Mongo { uri: _, .. } => {
      Err("MongoDB does not support renaming databases via this interface.".to_string())
    }
    ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri).await?;
      provider
        .execute_raw(
          &format!("ALTER DATABASE \"{}\" RENAME TO \"{}\"", oldName, newName),
          vec![],
        )
        .await
        .map_err_string()?;
      Ok(())
    }
    ConnectionConfigEnum::MySql { uri: _, .. } => Err(
      "MySQL does not support renaming databases directly. Create a new database and migrate data."
        .to_string(),
    ),
  }
}

#[tauri::command]
pub async fn delete_database(connId: &str, name: &str) -> Result<(), String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(connId) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(connId)?;
  validate_name(name)?;
  let entry = get_connection_entry(connId).await?;

  match &entry.config.config {
    ConnectionConfigEnum::Sqlite { .. } => Err(
      "SQLite database cannot be deleted. Delete the connection and remove the file.".to_string(),
    ),
    ConnectionConfigEnum::Json { path, .. } => {
      NosqlOrmAdapter::drop_database_json(path, name).await
    }
    ConnectionConfigEnum::Redis { .. } => {
      Err("Redis does not support deleting databases.".to_string())
    }
    ConnectionConfigEnum::Mongo { .. } => {
      Err("MongoDB database deletion is not supported via this interface.".to_string())
    }
    ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri).await?;
      provider
        .execute_raw(&format!("DROP DATABASE \"{}\"", name), vec![])
        .await
        .map_err_string()?;
      Ok(())
    }
    ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::create_mysql_provider(uri).await?;
      provider
        .execute_raw(&format!("DROP DATABASE IF EXISTS `{}`", name), vec![])
        .await
        .map_err_string()?;
      Ok(())
    }
  }
}

#[tauri::command]
pub async fn list_collections(
  connId: &str,
  dbName: Option<String>,
) -> Result<Vec<CollectionMeta>, String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(connId) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(connId)?;
  tracing::debug!("list_collections started for connection: {}", connId);
  let entry = get_connection_entry(connId).await?;
  tracing::debug!("list_collections got connection entry for: {}", connId);

  tokio::time::timeout(std::time::Duration::from_secs(10), async {
    match &entry.config.config {
      ConnectionConfigEnum::Json { path, .. } => {
        let path_obj = std::path::Path::new(path).to_path_buf();
        if !path_obj.is_dir() {
          return Ok(Vec::new());
        }

        if let Some(dbName) = dbName {
          let db_path = path_obj.join(&dbName);
          let collections = list_json_files_in_dir(db_path).await?;
          Ok(collections)
        } else {
          let mut all_collections: Vec<CollectionMeta> = Vec::new();
          let mut entries = match tokio::fs::read_dir(&path_obj).await {
            Ok(e) => e,
            Err(_) => return Ok(Vec::new()),
          };

          while let Some(entry) = entries.next_entry().await.map_err_string()? {
            let entry_path = entry.path();
            if entry_path.is_dir() {
              let collections = list_json_files_in_dir(entry_path).await?;
              all_collections.extend(collections);
            }
          }
          Ok(all_collections)
        }
      }
      _ => {
        tracing::debug!("list_collections dispatching provider for: {}", connId);
        dispatch_provider_cached!(entry, connId, provider => {
            tracing::debug!("list_collections provider dispatched, calling list_collections on provider");
            let collections = provider.list_collections().await.map_err_string()?;
            tracing::debug!("list_collections got {} collections", collections.len());
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
  })
  .await
  .map_err(|_| {
    tracing::error!("list_collections timed out for connection: {}", connId);
    "List collections timed out".to_string()
  })?
}

async fn count_json_files_in_dir(path: &std::path::Path) -> u64 {
  let mut entries = match tokio::fs::read_dir(path).await {
    Ok(e) => e,
    Err(_) => return 0,
  };

  let mut count = 0u64;
  while let Ok(Some(entry)) = entries.next_entry().await {
    if entry.path().extension().is_some_and(|ext| ext == "json") {
      count += 1;
    }
  }
  count
}

async fn list_json_files_in_dir(
  path_obj: std::path::PathBuf,
) -> Result<Vec<CollectionMeta>, String> {
  let mut collections: Vec<CollectionMeta> = Vec::new();
  let mut entries = match tokio::fs::read_dir(&path_obj).await {
    Ok(e) => e,
    Err(_) => return Ok(Vec::new()),
  };

  while let Some(entry) = entries.next_entry().await.map_err_string()? {
    let entry_path = entry.path();
    if entry_path.is_file() && entry_path.extension().is_some_and(|ext| ext == "json") {
      let file_name = entry
        .file_name()
        .into_string()
        .ok()
        .map(|n| n.trim_end_matches(".json").to_string());

      if let Some(name) = file_name {
        collections.push(CollectionMeta { name, count: 0 });
      }
    }
  }

  Ok(collections)
}

#[tauri::command]
pub async fn describe_collection(
  connId: &str,
  collection: &str,
) -> Result<CollectionSchema, String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(connId) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(connId)?;
  validate_name(collection)?;
  let entry = get_connection_entry(connId).await?;

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
  connId: &str,
  collection: &str,
) -> Result<CollectionStats, String> {
  let auth = get_auth_context();
  if !auth.can_access_connection(connId) {
    return Err("Access denied to connection".to_string());
  }
  validate_conn_id(connId)?;
  validate_name(collection)?;
  let entry = get_connection_entry(connId).await?;

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

#[tauri::command]
pub async fn list_databases_for_uri(
  provider_type: &str,
  uri: &str,
) -> Result<Vec<DatabaseMeta>, String> {
  if uri.is_empty() {
    return Err("URI cannot be empty".to_string());
  }
  validate_name(provider_type)?;

  match provider_type {
    "postgres" => {
      let provider = crate::commands::provider::create_postgres_provider(uri).await?;
      let result = provider
        .execute_raw(
          "SELECT datname FROM pg_database WHERE datistemplate = false",
          vec![],
        )
        .await
        .map_err_string()?;
      Ok(parse_database_rows(&result.rows))
    }
    "mysql" => {
      let provider = crate::commands::provider::create_mysql_provider(uri).await?;
      let result = provider
        .execute_raw("SHOW DATABASES", vec![])
        .await
        .map_err_string()?;
      Ok(parse_database_rows(&result.rows))
    }
    "mongodb" => {
      let provider = crate::commands::provider::create_mongo_provider(uri, "admin").await?;
      let result = provider
        .execute_raw("listDatabases", vec![])
        .await
        .map_err_string()?;
      let mut dbs = Vec::new();
      for row in result.rows {
        if let Some(doc) = row.get(0).and_then(|v| v.as_object()) {
          if let Some(name) = doc.get("name").and_then(|v| v.as_str()) {
            dbs.push(DatabaseMeta {
              name: name.to_string(),
              size_bytes: None,
              table_count: None,
            });
          }
        }
      }
      Ok(dbs)
    }
    "redis" => {
      let provider = crate::commands::provider::create_redis_provider(uri).await?;
      let result = provider
        .execute_raw("INFO keyspace", vec![])
        .await
        .map_err_string()?;
      let mut dbs = Vec::new();
      for row in result.rows {
        if let Some(line) = row.first().and_then(|v| v.as_str()) {
          for part in line.lines() {
            if part.starts_with("db") {
              if let Some(name) = part.split(',').next().and_then(|s| s.split('=').last()) {
                dbs.push(DatabaseMeta {
                  name: name.to_string(),
                  size_bytes: None,
                  table_count: None,
                });
              }
            }
          }
        }
      }
      if dbs.is_empty() {
        dbs.push(DatabaseMeta {
          name: "default".to_string(),
          size_bytes: None,
          table_count: None,
        });
      }
      Ok(dbs)
    }
    _ => Ok(vec![DatabaseMeta {
      name: "default".to_string(),
      size_bytes: None,
      table_count: None,
    }]),
  }
}
