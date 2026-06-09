use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_auth_context;
use crate::commands::get_connection_entry;
use crate::commands::types::{
  parse_database_rows, CollectionMeta, CollectionSchema, CollectionStats, ColumnInfo, DatabaseMeta,
};
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::dispatch_provider;
use crate::dispatch_provider_cached;
use crate::infrastructure::nosql_orm_adapter::NosqlOrmAdapter;
use crate::models::response::ResponseModel;
use nosql_orm::prelude::*;
use std::path::PathBuf;

fn validate_safe_path(base: &str, user_input: &str) -> Result<PathBuf, String> {
  crate::infrastructure::nosql_orm_adapter::validate_safe_path(base, user_input)
}

#[tauri::command]
pub async fn list_databases(conn_id: &str) -> Result<ResponseModel, ResponseModel> {
  validate_conn_id(conn_id).map_err(|e| ResponseModel::error(e))?;
  let entry = get_connection_entry(conn_id)
    .await
    .map_err(|e| ResponseModel::error(e))?;

  match &entry.config.config {
    ConnectionConfigEnum::Json { path: _, .. } => {
      let provider = NosqlOrmAdapter::create_provider(&entry.config.config)
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      let databases = provider
        .list_databases()
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      Ok(ResponseModel::success(databases))
    }
    ConnectionConfigEnum::Sqlite { path, .. } => {
      let db_name = std::path::Path::new(path)
        .file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("database")
        .to_string();
      Ok(ResponseModel::success(vec![DatabaseMeta::from_name(
        &db_name,
      )]))
    }
    ConnectionConfigEnum::Redis { .. } => {
      Ok(ResponseModel::success(vec![DatabaseMeta::from_name(
        "default",
      )]))
    }
    ConnectionConfigEnum::Mongo { uri, .. } => {
      let provider = crate::commands::provider::get_or_create_mongo_provider(conn_id, uri, "admin")
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      let result = provider
        .execute_raw("listDatabases", vec![])
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
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
      Ok(ResponseModel::success(dbs))
    }
    ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::get_or_create_postgres_provider(conn_id, uri)
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      let result = provider
        .execute_raw(
          "SELECT datname FROM pg_database WHERE datistemplate = false",
          vec![],
        )
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      Ok(ResponseModel::success(parse_database_rows(&result.rows)))
    }
    ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::get_or_create_mysql_provider(conn_id, uri)
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      let result = provider
        .execute_raw("SHOW DATABASES", vec![])
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      Ok(ResponseModel::success(parse_database_rows(&result.rows)))
    }
  }
}

#[tauri::command]
pub async fn create_database(conn_id: &str, name: &str) -> Result<ResponseModel, ResponseModel> {
  let auth = get_auth_context();
  if !auth.can_access_connection(conn_id) {
    return Err(ResponseModel::error("Access denied to connection"));
  }
  validate_conn_id(conn_id).map_err(|e| ResponseModel::error(e))?;
  validate_name(name).map_err(|e| ResponseModel::error(e))?;
  let entry = get_connection_entry(conn_id)
    .await
    .map_err(|e| ResponseModel::error(e))?;

  match &entry.config.config {
    ConnectionConfigEnum::Sqlite { path, .. } => {
      if !std::path::Path::new(path).exists() {
        tokio::fs::File::create(path)
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
      }
      Ok(ResponseModel::success_message("Database created"))
    }
    ConnectionConfigEnum::Json { path, .. } => NosqlOrmAdapter::create_database_json(path, name)
      .await
      .map(|_| ResponseModel::success_message("Database created"))
      .map_err(|e| ResponseModel::error(e.to_string())),
    ConnectionConfigEnum::Redis { .. } => Ok(ResponseModel::success_message("Database created")),
    ConnectionConfigEnum::Mongo { uri, .. } => {
      let provider = crate::commands::provider::create_mongo_provider(uri, &name)
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      provider
        .execute_raw("create", vec![])
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      Ok(ResponseModel::success_message("Database created"))
    }
    ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri)
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      provider
        .execute_raw(&format!("CREATE DATABASE \"{}\"", name), vec![])
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      Ok(ResponseModel::success_message("Database created"))
    }
    ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::create_mysql_provider(uri)
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      provider
        .execute_raw(&format!("CREATE DATABASE IF NOT EXISTS `{}`", name), vec![])
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      Ok(ResponseModel::success_message("Database created"))
    }
  }
}

#[tauri::command]
pub async fn rename_database(
  conn_id: &str,
  old_name: &str,
  new_name: &str,
) -> Result<ResponseModel, ResponseModel> {
  let auth = get_auth_context();
  if !auth.can_access_connection(conn_id) {
    return Err(ResponseModel::error("Access denied to connection"));
  }
  validate_conn_id(conn_id).map_err(|e| ResponseModel::error(e))?;
  validate_name(old_name).map_err(|e| ResponseModel::error(e))?;
  validate_name(new_name).map_err(|e| ResponseModel::error(e))?;
  let entry = get_connection_entry(conn_id)
    .await
    .map_err(|e| ResponseModel::error(e))?;

  match &entry.config.config {
    ConnectionConfigEnum::Sqlite { .. } => Err(ResponseModel::error(
      "SQLite database cannot be renamed. Create a new connection with a different file path.",
    )),
    ConnectionConfigEnum::Json { path, .. } => {
      let old_path = validate_safe_path(path, old_name).map_err(|e| ResponseModel::error(e))?;
      let new_path = validate_safe_path(path, new_name).map_err(|e| ResponseModel::error(e))?;
      if old_path.exists() {
        tokio::fs::rename(&old_path, &new_path)
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
      }
      Ok(ResponseModel::success_message("Database renamed"))
    }
    ConnectionConfigEnum::Redis { .. } => Err(ResponseModel::error(
      "Redis does not support renaming databases.",
    )),
    ConnectionConfigEnum::Mongo { uri: _, .. } => Err(ResponseModel::error(
      "MongoDB does not support renaming databases via this interface.",
    )),
    ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri)
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      provider
        .execute_raw(
          &format!("ALTER DATABASE \"{}\" RENAME TO \"{}\"", old_name, new_name),
          vec![],
        )
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      Ok(ResponseModel::success_message("Database renamed"))
    }
    ConnectionConfigEnum::MySql { uri: _, .. } => Err(ResponseModel::error(
      "MySQL does not support renaming databases directly. Create a new database and migrate data.",
    )),
  }
}

#[tauri::command]
pub async fn delete_database(conn_id: &str, name: &str) -> Result<ResponseModel, ResponseModel> {
  let auth = get_auth_context();
  if !auth.can_access_connection(conn_id) {
    return Err(ResponseModel::error("Access denied to connection"));
  }
  validate_conn_id(conn_id).map_err(|e| ResponseModel::error(e))?;
  validate_name(name).map_err(|e| ResponseModel::error(e))?;
  let entry = get_connection_entry(conn_id)
    .await
    .map_err(|e| ResponseModel::error(e))?;

  match &entry.config.config {
    ConnectionConfigEnum::Sqlite { .. } => Err(ResponseModel::error(
      "SQLite database cannot be deleted. Delete the connection and remove the file.",
    )),
    ConnectionConfigEnum::Json { path, .. } => NosqlOrmAdapter::drop_database_json(path, name)
      .await
      .map(|_| ResponseModel::success_message("Database deleted"))
      .map_err(|e| ResponseModel::error(e.to_string())),
    ConnectionConfigEnum::Redis { .. } => Err(ResponseModel::error(
      "Redis does not support deleting databases.",
    )),
    ConnectionConfigEnum::Mongo { .. } => Err(ResponseModel::error(
      "MongoDB database deletion is not supported via this interface.",
    )),
    ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::create_postgres_provider(uri)
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      provider
        .execute_raw(&format!("DROP DATABASE \"{}\"", name), vec![])
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      Ok(ResponseModel::success_message("Database deleted"))
    }
    ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::create_mysql_provider(uri)
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      provider
        .execute_raw(&format!("DROP DATABASE IF EXISTS `{}`", name), vec![])
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      Ok(ResponseModel::success_message("Database deleted"))
    }
  }
}

#[tauri::command]
pub async fn list_collections(
  conn_id: &str,
  db_name: Option<String>,
) -> Result<ResponseModel, ResponseModel> {
  let auth = get_auth_context();
  if !auth.can_access_connection(conn_id) {
    return Err(ResponseModel::error("Access denied to connection"));
  }
  validate_conn_id(conn_id).map_err(|e| ResponseModel::error(e))?;
  tracing::debug!("list_collections started for connection: {}", conn_id);
  let entry = get_connection_entry(conn_id)
    .await
    .map_err(|e| ResponseModel::error(e))?;
  tracing::debug!("list_collections got connection entry for: {}", conn_id);

  tokio::time::timeout(std::time::Duration::from_secs(10), async {
    match&entry.config.config {
      ConnectionConfigEnum::Json { path, .. } => {
        let path_obj = std::path::Path::new(path).to_path_buf();
        if !path_obj.is_dir() {
          return Ok(ResponseModel::success(Vec::<CollectionMeta>::new()));
        }

        if let Some(db_name) = db_name {
          let db_path = path_obj.join(&db_name);
          let collections = list_json_files_in_dir(db_path).await?;
          Ok(ResponseModel::success(collections))
        } else {
          let mut all_collections: Vec<CollectionMeta> = Vec::new();
          let mut entries = match tokio::fs::read_dir(&path_obj).await {
            Ok(e) => e,
            Err(_) => return Ok(ResponseModel::success(Vec::<CollectionMeta>::new())),
          };

          while let Some(entry) = entries.next_entry().await.map_err_string()? {
            let entry_path = entry.path();
            if entry_path.is_dir() {
              let collections = list_json_files_in_dir(entry_path).await?;
              all_collections.extend(collections);
            }
          }
          Ok(ResponseModel::success(all_collections))
        }
      }
      _ => {
        tracing::debug!("list_collections dispatching provider for: {}", conn_id);
        dispatch_provider_cached!(entry, conn_id, provider => {
            tracing::debug!("list_collections provider dispatched, calling list_collections on provider");
            let collections = provider.list_collections().await.map_err_string()?;
            tracing::debug!("list_collections got {} collections", collections.len());
Ok(ResponseModel::success(
              collections
                .into_iter()
                .map(|c| CollectionMeta {
                    name: c.name,
                    count: c.document_count,
                })
                .collect::<Vec<CollectionMeta>>(),
            ))
        })
      }
    }
  })
  .await
  .map_err(|_| {
    tracing::error!("list_collections timed out for connection: {}", conn_id);
    ResponseModel::error("List collections timed out")
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
  conn_id: &str,
  collection: &str,
) -> Result<ResponseModel, ResponseModel> {
  let auth = get_auth_context();
  if !auth.can_access_connection(conn_id) {
    return Err(ResponseModel::error("Access denied to connection"));
  }
  validate_conn_id(conn_id).map_err(|e| ResponseModel::error(e))?;
  validate_name(collection).map_err(|e| ResponseModel::error(e))?;
  let entry = get_connection_entry(conn_id)
    .await
    .map_err(|e| ResponseModel::error(e))?;

  let (schema, indexes) = dispatch_provider!(entry, provider => {
      let schema = provider.describe_collection(collection).await.map_err_string()?;
      let indexes = nosql_orm::provider::SchemaIntrospection::list_indexes(&provider, collection)
          .await
          .map_err_string()?;
      Ok::<_, String>((schema, indexes))
  })
  .map_err(|e| ResponseModel::error(e))?;

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

  let index_infos: Vec<crate::commands::types::IndexInfo> = indexes
    .into_iter()
    .map(|idx| crate::commands::types::IndexInfo {
      name: idx.name,
      columns: idx.fields,
      is_unique: idx.unique,
    })
    .collect();

  Ok(ResponseModel::success(CollectionSchema {
    name: collection.to_string(),
    columns,
    indexes: index_infos,
  }))
}

#[tauri::command]
pub async fn get_collection_stats(
  conn_id: &str,
  collection: &str,
) -> Result<ResponseModel, ResponseModel> {
  let auth = get_auth_context();
  if !auth.can_access_connection(conn_id) {
    return Err(ResponseModel::error("Access denied to connection"));
  }
  validate_conn_id(conn_id).map_err(|e| ResponseModel::error(e))?;
  validate_name(collection).map_err(|e| ResponseModel::error(e))?;
  let entry = get_connection_entry(conn_id)
    .await
    .map_err(|e| ResponseModel::error(e))?;

  let stats = dispatch_provider!(entry, provider => {
      provider.get_collection_stats(collection).await.map_err_string()
  })
  .map_err(|e| ResponseModel::error(e))?;

  Ok(ResponseModel::success(CollectionStats {
    name: collection.to_string(),
    document_count: stats.document_count,
    size_bytes: stats.size_bytes,
    index_count: stats.index_count,
  }))
}

#[tauri::command]
pub async fn list_databases_for_uri(
  provider_type: &str,
  uri: &str,
) -> Result<ResponseModel, ResponseModel> {
  if uri.is_empty() {
    return Err(ResponseModel::error("URI cannot be empty"));
  }
  validate_name(provider_type).map_err(|e| ResponseModel::error(e))?;

  match provider_type {
    "postgres" => {
      let provider = crate::commands::provider::create_postgres_provider(uri)
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      let result = provider
        .execute_raw(
          "SELECT datname FROM pg_database WHERE datistemplate = false",
          vec![],
        )
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      Ok(ResponseModel::success(parse_database_rows(&result.rows)))
    }
    "mysql" => {
      let provider = crate::commands::provider::create_mysql_provider(uri)
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      let result = provider
        .execute_raw("SHOW DATABASES", vec![])
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      Ok(ResponseModel::success(parse_database_rows(&result.rows)))
    }
    "mongodb" => {
      let provider = crate::commands::provider::create_mongo_provider(uri, "admin")
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      let result = provider
        .execute_raw("listDatabases", vec![])
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
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
      Ok(ResponseModel::success(dbs))
    }
    "redis" => {
      let provider = crate::commands::provider::create_redis_provider(uri)
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      let result = provider
        .execute_raw("INFO keyspace", vec![])
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
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
      Ok(ResponseModel::success(dbs))
    }
    _ => Ok(ResponseModel::success(vec![DatabaseMeta {
      name: "default".to_string(),
      size_bytes: None,
      table_count: None,
    }])),
  }
}
