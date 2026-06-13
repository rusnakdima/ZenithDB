use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::types::{CollectionSchema, CollectionStats, ColumnInfo};
use crate::commands::validate_conn_id;
use crate::commands::validate_name;
use crate::dispatch_provider;
use crate::infrastructure::nosql_orm_adapter::NosqlOrmAdapter;
use crate::logger::DataflowTimer;
use crate::models::response::ResponseModel;
use nosql_orm::prelude::*;
use std::path::PathBuf;

fn validate_safe_path(base: &str, user_input: &str) -> Result<PathBuf, String> {
  crate::infrastructure::nosql_orm_adapter::validate_safe_path(base, user_input)
}

#[tauri::command]
pub async fn create_database(
  connection_id: &str,
  name: &str,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("create_database");
  let result = (|| async {
    validate_conn_id(connection_id).map_err(|e| ResponseModel::error(e))?;
    validate_name(name).map_err(|e| ResponseModel::error(e))?;
    let entry = get_connection_entry(connection_id)
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
  })()
  .await;
  match &result {
    Ok(resp) => timer.finish(resp),
    Err(err) => timer.finish_error(&err.message),
  }
  result
}

#[tauri::command]
pub async fn rename_database(
  connection_id: &str,
  old_name: &str,
  new_name: &str,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("rename_database");
  let result = (|| async {
    validate_conn_id(connection_id).map_err(|e| ResponseModel::error(e))?;
    validate_name(old_name).map_err(|e| ResponseModel::error(e))?;
    validate_name(new_name).map_err(|e| ResponseModel::error(e))?;
    let entry = get_connection_entry(connection_id)
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
  })().await;
  match &result {
    Ok(resp) => timer.finish(resp),
    Err(err) => timer.finish_error(&err.message),
  }
  result
}

#[tauri::command]
pub async fn delete_database(
  connection_id: &str,
  name: &str,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("delete_database");
  let result = (|| async {
    validate_conn_id(connection_id).map_err(|e| ResponseModel::error(e))?;
    validate_name(name).map_err(|e| ResponseModel::error(e))?;
    let entry = get_connection_entry(connection_id)
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
  })()
  .await;
  match &result {
    Ok(resp) => timer.finish(resp),
    Err(err) => timer.finish_error(&err.message),
  }
  result
}

#[tauri::command]
pub async fn describe_collection(
  connection_id: &str,
  collection: &str,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("describe_collection");
  let result: Result<ResponseModel, ResponseModel> = (|| async {
    validate_conn_id(connection_id).map_err(|e| ResponseModel::error(e))?;
    validate_name(collection).map_err(|e| ResponseModel::error(e))?;
    let entry = get_connection_entry(connection_id)
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
  })()
  .await;
  match &result {
    Ok(resp) => timer.finish(resp),
    Err(err) => timer.finish_error(&err.message),
  }
  result
}

#[tauri::command]
pub async fn get_collection_stats(
  connection_id: &str,
  collection: &str,
) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("get_collection_stats");
  let result: Result<ResponseModel, ResponseModel> = (|| async {
    validate_conn_id(connection_id).map_err(|e| ResponseModel::error(e))?;
    validate_name(collection).map_err(|e| ResponseModel::error(e))?;
    let entry = get_connection_entry(connection_id)
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
  })()
  .await;
  match &result {
    Ok(resp) => timer.finish(resp),
    Err(err) => timer.finish_error(&err.message),
  }
  result
}
