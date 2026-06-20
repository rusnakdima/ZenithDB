use crate::constants::LIST_TIMEOUT_SECS;
use crate::models::response::{Response, ResponseModel};
use crate::utils::metrics::{redact_sensitive_data, DataflowTimer};
use chrono::{DateTime, Local, Utc};
use nosql_orm::prelude::*;
use nosql_orm::providers::sql::SqliteProvider;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;
use sysinfo::{Disks, Networks, System};
use tokio::sync::Mutex;
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseMetadata {
  pub id: i64,
  pub connection_id: String,
  pub name: String,
  pub path: Option<String>,
  pub created_at: i64,
  pub updated_at: i64,
  pub metadata: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct DatabaseMetadataEntity {
  pub id: Option<String>,
  pub connection_id: String,
  pub name: String,
  pub path: Option<String>,
  pub created_at: Option<DateTime<Utc>>,
  pub updated_at: Option<DateTime<Utc>>,
  pub metadata: Option<String>,
}
impl Entity for DatabaseMetadataEntity {
  fn meta() -> EntityMeta {
    EntityMeta::new("database_metadata")
  }
  fn get_id(&self) -> Option<String> {
    self.id.clone()
  }
  fn set_id(&mut self, id: String) {
    self.id = Some(id);
  }
}
impl WithRelations for DatabaseMetadataEntity {
  fn relations() -> Vec<RelationDef> {
    vec![]
  }
}
impl Timestamps for DatabaseMetadataEntity {
  fn created_at(&self) -> Option<DateTime<Utc>> {
    self.created_at
  }
  fn updated_at(&self) -> Option<DateTime<Utc>> {
    self.updated_at
  }
  fn set_created_at(&mut self, t: DateTime<Utc>) {
    self.created_at = Some(t);
  }
  fn set_updated_at(&mut self, t: DateTime<Utc>) {
    self.updated_at = Some(t);
  }
  fn apply_timestamps_for_insert(&mut self) {
    let now = Utc::now();
    if self.created_at.is_none() {
      self.created_at = Some(now);
    }
    if self.updated_at.is_none() {
      self.updated_at = Some(now);
    }
  }
  fn apply_timestamps_for_update(&mut self) {
    self.updated_at = Some(Utc::now());
  }
}
impl SoftDeletable for DatabaseMetadataEntity {
  fn deleted_at(&self) -> Option<DateTime<Utc>> {
    None
  }
  fn set_deleted_at(&mut self, _t: Option<DateTime<Utc>>) {}
}
impl From<DatabaseMetadataEntity> for DatabaseMetadata {
  fn from(entity: DatabaseMetadataEntity) -> Self {
    let created_at = entity
      .created_at
      .map(|dt| dt.timestamp())
      .unwrap_or_else(|| Utc::now().timestamp());
    let updated_at = entity
      .updated_at
      .map(|dt| dt.timestamp())
      .unwrap_or_else(|| Utc::now().timestamp());
    DatabaseMetadata {
      id: entity.id.and_then(|s| s.parse().ok()).unwrap_or(0),
      connection_id: entity.connection_id,
      name: entity.name,
      path: entity.path,
      created_at,
      updated_at,
      metadata: entity.metadata,
    }
  }
}
struct MetadataDb {
  repo: Repository<DatabaseMetadataEntity, SqliteProvider>,
  provider: SqliteProvider,
}
impl MetadataDb {
  async fn new() -> Result<Self, String> {
    let db_path = Self::path()?;
    if let Some(parent) = db_path.parent() {
      std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let provider = SqliteProvider::connect(db_path.to_string_lossy().as_ref())
      .await
      .map_err(|e| format!("Failed to open metadata db: {}", e))?;
    let repo = Repository::new(provider.clone());
    let db = Self { repo, provider };
    db.init().await?;
    Ok(db)
  }
  fn path() -> Result<PathBuf, String> {
    let path = dirs::home_dir()
      .ok_or("Failed to get home dir")?
      .join(".zenithdb")
      .join("metadata.db");
    Ok(path)
  }
  async fn init(&self) -> Result<(), String> {
    let db_path = Self::path()?;
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    conn
      .execute(
        "CREATE TABLE IF NOT EXISTS database_metadata (
          id TEXT PRIMARY KEY,
          connection_id TEXT NOT NULL,
          name TEXT NOT NULL,
          path TEXT,
          created_at TEXT,
          updated_at TEXT,
          metadata TEXT
        )",
        [],
      )
      .map_err(|e| e.to_string())?;
    Ok(())
  }
  async fn save(&self, entity: &DatabaseMetadataEntity) -> Result<DatabaseMetadataEntity, String> {
    self
      .repo
      .save(entity.clone())
      .await
      .map_err(|e| e.to_string())
  }
  async fn find_by_id(&self, id: &str) -> Result<Option<DatabaseMetadataEntity>, String> {
    self.repo.find_by_id(id).await.map_err(|e| e.to_string())
  }
  async fn find_by_connection_id(
    &self,
    connection_id: &str,
  ) -> Result<Vec<DatabaseMetadataEntity>, String> {
    let all = self.repo.find_all().await.map_err(|e| e.to_string())?;
    Ok(
      all
        .into_iter()
        .filter(|e| e.connection_id == connection_id)
        .collect(),
    )
  }
  async fn update(
    &self,
    id: &str,
    name: &str,
    path: Option<&str>,
    metadata: Option<&str>,
  ) -> Result<DatabaseMetadataEntity, String> {
    let mut entity = self
      .repo
      .find_by_id(id)
      .await
      .map_err(|e| e.to_string())?
      .ok_or_else(|| format!("Database {} not found", id))?;
    entity.name = name.to_string();
    entity.path = path.map(|p| p.to_string());
    entity.metadata = metadata.map(|m| m.to_string());
    entity.apply_timestamps_for_update();
    self.repo.save(entity).await.map_err(|e| e.to_string())
  }
  async fn delete(&self, id: &str) -> Result<(), String> {
    self.repo.delete(id).await.map_err(|e| e.to_string())?;
    Ok(())
  }
  async fn delete_by_connection_id(connection_id: &str) -> Result<(), String> {
    let db = Self::get_instance().await?;
    let guard = db.lock().await;
    let entities = guard.find_by_connection_id(connection_id).await?;
    for entity in entities {
      if let Some(id) = entity.id.clone() {
        guard.delete(&id).await?;
      }
    }
    Ok(())
  }
  async fn get_instance() -> Result<Arc<Mutex<MetadataDb>>, String> {
    static SERVICE: tokio::sync::OnceCell<Arc<Mutex<MetadataDb>>> =
      tokio::sync::OnceCell::const_new();
    SERVICE
      .get_or_try_init(|| async { Self::new().await.map(|db| Arc::new(Mutex::new(db))) })
      .await
      .map_err(|e| format!("Failed to create MetadataDb: {}", e))
      .map(|arc| arc.clone())
  }
}
pub struct DecentralizedStorage;
impl DecentralizedStorage {
  pub async fn init() -> Result<(), String> {
    MetadataDb::new().await?;
    Ok(())
  }
  pub async fn save_database(
    connection_id: &str,
    name: &str,
    path: Option<&str>,
    metadata: Option<&str>,
  ) -> Result<DatabaseMetadata, String> {
    let db = MetadataDb::get_instance().await?;
    let guard = db.lock().await;
    let id = uuid::Uuid::new_v4().to_string();
    let entity = DatabaseMetadataEntity {
      id: Some(id),
      connection_id: connection_id.to_string(),
      name: name.to_string(),
      path: path.map(|p| p.to_string()),
      created_at: None,
      updated_at: None,
      metadata: metadata.map(|m| m.to_string()),
    };
    let saved = guard.save(&entity).await?;
    Ok(saved.into())
  }
  pub async fn list_databases(connection_id: &str) -> Result<Vec<DatabaseMetadata>, String> {
    let db = MetadataDb::get_instance().await?;
    let guard = db.lock().await;
    let entities = guard.find_by_connection_id(connection_id).await?;
    Ok(entities.into_iter().map(|e| e.into()).collect())
  }
  pub async fn get_database(id: i64) -> Result<Option<DatabaseMetadata>, String> {
    let db = MetadataDb::get_instance().await?;
    let guard = db.lock().await;
    let entity = guard.find_by_id(&id.to_string()).await?;
    Ok(entity.map(|e| e.into()))
  }
  pub async fn update_database(
    id: i64,
    name: &str,
    path: Option<&str>,
    metadata: Option<&str>,
  ) -> Result<DatabaseMetadata, String> {
    let db = MetadataDb::get_instance().await?;
    let guard = db.lock().await;
    let updated = guard.update(&id.to_string(), name, path, metadata).await?;
    Ok(updated.into())
  }
  pub async fn delete_database(id: i64) -> Result<(), String> {
    let db = MetadataDb::get_instance().await?;
    let guard = db.lock().await;
    guard.delete(&id.to_string()).await
  }
  pub async fn delete_connection_databases(connection_id: &str) -> Result<(), String> {
    MetadataDb::delete_by_connection_id(connection_id).await
  }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
  pub cpu_usage: f32,
  pub ram_used: u64,
  pub ram_total: u64,
  pub disk_used: u64,
  pub disk_total: u64,
  pub network_received: u64,
  pub network_transmitted: u64,
  pub uptime: u64,
  pub status: String,
}
fn calculate_status(cpu_usage: f32, ram_used: u64, ram_total: u64) -> String {
  let ram_usage = if ram_total > 0 {
    (ram_used as f32 / ram_total as f32) * 100.0
  } else {
    0.0
  };
  let cpu_usage = if cpu_usage.is_nan() { 0.0 } else { cpu_usage };
  let ram_usage = if ram_usage.is_nan() { 0.0 } else { ram_usage };
  let max_usage = cpu_usage.max(ram_usage);
  if max_usage >= 90.0 {
    "critical".to_string()
  } else if max_usage >= 70.0 {
    "warning".to_string()
  } else {
    "optimal".to_string()
  }
}
fn get_logs_dir() -> Result<PathBuf, String> {
  let home = dirs::home_dir().ok_or("Could not find home directory")?;
  let logs_dir = home.join(".zenithdb").join("logs");
  if !logs_dir.exists() {
    fs::create_dir_all(&logs_dir).map_err(|e| format!("Failed to create logs directory: {}", e))?;
  }
  Ok(logs_dir)
}
#[tauri::command]
pub async fn init_decentralized_storage() -> Result<(), String> {
  let timer = DataflowTimer::new("init_decentralized_storage");
  match DecentralizedStorage::init().await {
    Ok(()) => {
      timer.finish_success();
      Ok(())
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command]
pub async fn save_database_metadata(
  connection_id: String,
  name: String,
  path: Option<String>,
  metadata: Option<String>,
) -> Result<DatabaseMetadata, String> {
  let timer = DataflowTimer::new("save_database_metadata");
  let params = serde_json::json!({ "connection_id": &connection_id, "name": &name, "path": path, "metadata": metadata });
  match DecentralizedStorage::save_database(
    &connection_id,
    &name,
    path.as_deref(),
    metadata.as_deref(),
  )
  .await
  {
    Ok(result) => {
      timer.finish_success();
      Ok(result)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command]
pub async fn list_databases_metadata(
  connection_id: String,
) -> Result<Vec<DatabaseMetadata>, String> {
  let timer = DataflowTimer::new("list_databases_metadata");
  let params = serde_json::json!({ "connection_id": &connection_id });
  match tokio::time::timeout(
    std::time::Duration::from_secs(LIST_TIMEOUT_SECS),
    DecentralizedStorage::list_databases(&connection_id),
  )
  .await
  {
    Ok(Ok(result)) => {
      timer.finish_success();
      Ok(result)
    }
    Ok(Err(e)) => {
      timer.finish_error(&e);
      Err(e)
    }
    Err(_) => {
      let e = "List databases timed out".to_string();
      timer.finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command]
pub async fn get_database_metadata(id: i64) -> Result<Option<DatabaseMetadata>, String> {
  let timer = DataflowTimer::new("get_database_metadata");
  let params = serde_json::json!({ "id": id });
  match DecentralizedStorage::get_database(id).await {
    Ok(result) => {
      timer.finish_success();
      Ok(result)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command]
pub async fn update_database_metadata(
  id: i64,
  name: String,
  path: Option<String>,
  metadata: Option<String>,
) -> Result<DatabaseMetadata, String> {
  let timer = DataflowTimer::new("update_database_metadata");
  let params = serde_json::json!({ "id": id, "name": &name, "path": path, "metadata": metadata });
  match DecentralizedStorage::update_database(id, &name, path.as_deref(), metadata.as_deref()).await
  {
    Ok(result) => {
      timer.finish_success();
      Ok(result)
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command]
pub async fn delete_database_metadata(id: i64) -> Result<(), String> {
  let timer = DataflowTimer::new("delete_database_metadata");
  let params = serde_json::json!({ "id": id });
  match DecentralizedStorage::delete_database(id).await {
    Ok(()) => {
      timer.finish_success();
      Ok(())
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command]
pub async fn delete_connection_databases_metadata(connection_id: String) -> Result<(), String> {
  let timer = DataflowTimer::new("delete_connection_databases_metadata");
  let params = serde_json::json!({ "connection_id": &connection_id });
  match DecentralizedStorage::delete_connection_databases(&connection_id).await {
    Ok(()) => {
      timer.finish_success();
      Ok(())
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}
#[tauri::command]
pub async fn get_system_status() -> Result<Response, String> {
  let timer = DataflowTimer::new("get_system_status");
  let sys = tokio::task::spawn_blocking(|| {
    let mut sys = System::new_all();
    sys.refresh_cpu_all();
    sys.refresh_memory();
    let cpu_usage = sys.global_cpu_usage();
    let ram_used = sys.used_memory();
    let ram_total = sys.total_memory();
    let disks = Disks::new_with_refreshed_list();
    let (disk_used, disk_total) = disks.iter().fold((0u64, 0u64), |(used, total), disk| {
      let disk_used = disk.total_space().saturating_sub(disk.available_space());
      (
        used.saturating_add(disk_used),
        total.saturating_add(disk.total_space()),
      )
    });
    let networks = Networks::new_with_refreshed_list();
    let (network_received, network_transmitted) =
      networks
        .iter()
        .fold((0u64, 0u64), |(recv, trans), (_, data)| {
          (
            recv.saturating_add(data.total_received()),
            trans.saturating_add(data.total_transmitted()),
          )
        });
    let uptime = System::uptime();
    let status = calculate_status(cpu_usage, ram_used, ram_total);
    SystemMetrics {
      cpu_usage,
      ram_used,
      ram_total,
      disk_used,
      disk_total,
      network_received,
      network_transmitted,
      uptime,
      status,
    }
  })
  .await
  .map_err(|e| {
    timer
      .clone()
      .finish_error(&format!("Task join error: {}", e));
    format!("Task join error: {}", e)
  })?;
  timer.finish_success();
  Ok(Response::success(
    "System status retrieved",
    serde_json::to_value(sys).unwrap_or(serde_json::Value::Null),
  ))
}
#[tauri::command]
pub async fn save_log_file(filename: String, data: String) -> Result<Response, String> {
  let timer = DataflowTimer::new("save_log_file");
  let logs_dir = get_logs_dir()?;
  let file_path = logs_dir.join(&filename);
  fs::write(&file_path, &data).map_err(|e| {
    timer
      .clone()
      .finish_error(&format!("Failed to write log file: {}", e));
    format!("Failed to write log file: {}", e)
  })?;
  Ok(Response::success(
    "Log file saved",
    serde_json::Value::String(file_path.to_string_lossy().to_string()),
  ))
}
#[tauri::command]
pub async fn append_log_file(data: String) -> Result<Response, String> {
  let timer = DataflowTimer::new("append_log_file");
  let logs_dir = get_logs_dir()?;
  let date = Local::now().format("%Y-%m-%d").to_string();
  let filename = format!("dataflow-{}.jsonl", date);
  let file_path = logs_dir.join(&filename);
  let mut file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(&file_path)
    .map_err(|e| {
      timer
        .clone()
        .finish_error(&format!("Failed to open log file: {}", e));
      format!("Failed to open log file: {}", e)
    })?;
  writeln!(file, "{}", data).map_err(|e| {
    timer
      .clone()
      .finish_error(&format!("Failed to write to log file: {}", e));
    format!("Failed to write to log file: {}", e)
  })?;
  Ok(Response::success(
    "Log appended",
    serde_json::Value::String(file_path.to_string_lossy().to_string()),
  ))
}
