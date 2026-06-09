use crate::commands::connection::ConnectionConfigEnum;
use crate::commands::error_utils::ToStringError;
use crate::commands::get_connection_entry;
use crate::commands::types::DatabaseMeta;
use crate::commands::validate_conn_id;
use crate::models::response::ResponseModel;
use nosql_orm::prelude::*;

const MAX_DIRS_PER_LEVEL: usize = 10;
const MAX_FILES_PER_DIR: usize = 10_000;
const SCAN_TIMEOUT_SECS: u64 = 30;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DatabaseListResult {
  pub databases: Vec<DatabaseMeta>,
  pub has_more: bool,
  pub total_count: usize,
}

#[tauri::command]
pub async fn database_list(
  conn_id: String,
  offset: Option<usize>,
  limit: Option<usize>,
) -> Result<ResponseModel, ResponseModel> {
  validate_conn_id(&conn_id).map_err(|e| ResponseModel::error(e))?;
  let entry = get_connection_entry(&conn_id)
    .await
    .map_err(|e| ResponseModel::error(e))?;
  let offset = offset.unwrap_or(0);
  let limit = limit.unwrap_or(MAX_DIRS_PER_LEVEL);

  match &entry.config.config {
    ConnectionConfigEnum::Json { path, .. } => {
      let path_obj = std::path::Path::new(path).to_path_buf();
      if !path_obj.is_dir() {
        return Ok(ResponseModel::success(DatabaseListResult {
          databases: Vec::new(),
          has_more: false,
          total_count: 0,
        }));
      }

      let result = list_json_databases(path_obj.clone(), offset, limit)
        .await
        .map_err(|e| ResponseModel::error(e))?;
      Ok(ResponseModel::success(result))
    }
    ConnectionConfigEnum::Sqlite { path, .. } => {
      let db_name = std::path::Path::new(path)
        .file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("database")
        .to_string();
      Ok(ResponseModel::success(DatabaseListResult {
        databases: vec![DatabaseMeta::from_name(&db_name)],
        has_more: false,
        total_count: 1,
      }))
    }
    ConnectionConfigEnum::Redis { .. } => Ok(ResponseModel::success(DatabaseListResult {
      databases: vec![DatabaseMeta::from_name("default")],
      has_more: false,
      total_count: 1,
    })),
    ConnectionConfigEnum::Mongo { uri, .. } => {
      let provider =
        crate::commands::provider::get_or_create_mongo_provider(&conn_id, uri, "admin")
          .await
          .map_err(|e| ResponseModel::error(e.to_string()))?;
      let db_names = provider.list_databases().await.map_err_string()?;
      let total_count = db_names.len();
      let has_more = offset + limit < total_count;
      let dbs: Vec<DatabaseMeta> = db_names
        .into_iter()
        .skip(offset)
        .take(limit)
        .map(|name| DatabaseMeta {
          name,
          size_bytes: None,
          table_count: None,
        })
        .collect();
      Ok(ResponseModel::success(DatabaseListResult {
        databases: dbs,
        has_more,
        total_count,
      }))
    }
    ConnectionConfigEnum::Postgres { uri, .. } => {
      let provider = crate::commands::provider::get_or_create_postgres_provider(&conn_id, uri)
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      let db_names = provider.list_databases().await.map_err_string()?;
      let total_count = db_names.len();
      let has_more = offset + limit < total_count;
      let dbs: Vec<DatabaseMeta> = db_names
        .into_iter()
        .skip(offset)
        .take(limit)
        .map(|name| DatabaseMeta {
          name,
          size_bytes: None,
          table_count: None,
        })
        .collect();
      Ok(ResponseModel::success(DatabaseListResult {
        databases: dbs,
        has_more,
        total_count,
      }))
    }
    ConnectionConfigEnum::MySql { uri, .. } => {
      let provider = crate::commands::provider::get_or_create_mysql_provider(&conn_id, uri)
        .await
        .map_err(|e| ResponseModel::error(e.to_string()))?;
      let db_names = provider.list_databases().await.map_err_string()?;
      let total_count = db_names.len();
      let has_more = offset + limit < total_count;
      let dbs: Vec<DatabaseMeta> = db_names
        .into_iter()
        .skip(offset)
        .take(limit)
        .map(|name| DatabaseMeta {
          name,
          size_bytes: None,
          table_count: None,
        })
        .collect();
      Ok(ResponseModel::success(DatabaseListResult {
        databases: dbs,
        has_more,
        total_count,
      }))
    }
  }
}

async fn list_json_databases(
  path_obj: std::path::PathBuf,
  offset: usize,
  limit: usize,
) -> Result<DatabaseListResult, String> {
  let timeout_result =
    tokio::time::timeout(std::time::Duration::from_secs(SCAN_TIMEOUT_SECS), async {
      let mut databases: Vec<DatabaseMeta> = Vec::new();
      let mut entries = match tokio::fs::read_dir(&path_obj).await {
        Ok(e) => e,
        Err(_) => {
          return Ok(DatabaseListResult {
            databases: Vec::new(),
            has_more: false,
            total_count: 0,
          })
        }
      };

      let mut total_count = 0usize;
      while let Some(entry) = entries.next_entry().await.map_err_string()? {
        let entry_path = entry.path();
        if entry_path.is_dir() {
          total_count += 1;
          if databases.len() < limit * 2 {
            let name = entry.file_name().into_string().ok().map(|n| n.to_string());
            if let Some(name) = name {
              databases.push(DatabaseMeta::from_name(&name));
            }
          }
        }
      }

      databases.sort_by(|a, b| a.name.cmp(&b.name));
      let has_more = offset + limit < total_count;
      let result = databases.into_iter().skip(offset).take(limit).collect();

      Ok(DatabaseListResult {
        databases: result,
        has_more,
        total_count,
      })
    })
    .await;

  match timeout_result {
    Ok(Ok(result)) => Ok(result),
    Ok(Err(e)) => Err(e),
    Err(_) => Err("Database listing timed out".to_string()),
  }
}
