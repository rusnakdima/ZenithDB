use crate::constants::LIST_TIMEOUT_SECS;
use crate::logger::{redact_sensitive_data, DataflowTimer};
use crate::models::response::ResponseModel;
use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Local;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use sysinfo::{Disks, Networks, System};
use tauri::AppHandle;

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

pub struct DecentralizedStorage;

impl DecentralizedStorage {
  pub fn path() -> PathBuf {
    dirs::home_dir()
      .unwrap_or_else(|| PathBuf::from("."))
      .join(".zenithdb")
      .join("metadata.db")
  }

  pub async fn init() -> Result<(), String> {
    let path = Self::path();

    if let Some(parent) = path.parent() {
      tokio::fs::create_dir_all(parent)
        .await
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let path_clone = path.clone();
    tokio::task::spawn_blocking(move || {
      let conn =
        Connection::open(&path_clone).map_err(|e| format!("Failed to open database: {}", e))?;

      conn
        .execute(
          "CREATE TABLE IF NOT EXISTS database_metadata (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    connection_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    path TEXT,
                    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                    metadata TEXT
                )",
          [],
        )
        .map_err(|e| format!("Failed to create table: {}", e))?;

      conn
        .execute(
          "CREATE INDEX IF NOT EXISTS idx_connection_id ON database_metadata(connection_id)",
          [],
        )
        .map_err(|e| format!("Failed to create index: {}", e))?;

      Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Init task failed: {:?}", e))?
  }

  pub async fn save_database(
    connection_id: &str,
    name: &str,
    path: Option<&str>,
    metadata: Option<&str>,
  ) -> Result<DatabaseMetadata, String> {
    let db_path = Self::path();
    let conn_id = connection_id.to_string();
    let db_name = name.to_string();
    let db_path_owned = path.map(|p| p.to_string());
    let db_metadata_owned = metadata.map(|m| m.to_string());
    let now = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map_err(|e| format!("Time error: {}", e))?
      .as_secs() as i64;

    let result_conn_id = conn_id.clone();
    let result_db_name = db_name.clone();
    let result_path = db_path_owned.clone();
    let result_metadata = db_metadata_owned.clone();

    tokio::task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .map_err(|e| format!("Failed to open database: {}", e))?;

            conn.execute(
                "INSERT INTO database_metadata (connection_id, name, path, created_at, updated_at, metadata) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![conn_id, db_name, db_path_owned, now, now, db_metadata_owned],
            )
            .map_err(|e| format!("Failed to insert database: {}", e))?;

            let id = conn.last_insert_rowid();

            Ok::<DatabaseMetadata, String>(DatabaseMetadata {
                id,
                connection_id: result_conn_id,
                name: result_db_name,
                path: result_path,
                created_at: now,
                updated_at: now,
                metadata: result_metadata,
            })
        })
        .await
        .map_err(|e| format!("save_database task failed: {:?}", e))?
  }

  pub async fn list_databases(connection_id: &str) -> Result<Vec<DatabaseMetadata>, String> {
    let db_path = Self::path();
    let conn_id = connection_id.to_string();

    tokio::task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .map_err(|e| format!("Failed to open database: {}", e))?;

            let mut stmt = conn
                .prepare("SELECT id, connection_id, name, path, created_at, updated_at, metadata FROM database_metadata WHERE connection_id = ?1 ORDER BY created_at DESC")
                .map_err(|e| format!("Failed to prepare statement: {}", e))?;

            let rows = stmt
                .query_map(params![conn_id], |row| {
                    Ok(DatabaseMetadata {
                        id: row.get(0)?,
                        connection_id: row.get(1)?,
                        name: row.get(2)?,
                        path: row.get(3)?,
                        created_at: row.get(4)?,
                        updated_at: row.get(5)?,
                        metadata: row.get(6)?,
                    })
                })
                .map_err(|e| format!("Failed to query: {}", e))?;

            let mut databases = Vec::new();
            for row in rows {
                databases.push(row.map_err(|e| format!("Failed to read row: {}", e))?);
            }

            Ok(databases)
        })
        .await
        .map_err(|e| format!("list_databases task failed: {:?}", e))?
  }

  pub async fn get_database(id: i64) -> Result<Option<DatabaseMetadata>, String> {
    let db_path = Self::path();

    tokio::task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .map_err(|e| format!("Failed to open database: {}", e))?;

            let mut stmt = conn
                .prepare("SELECT id, connection_id, name, path, created_at, updated_at, metadata FROM database_metadata WHERE id = ?1")
                .map_err(|e| format!("Failed to prepare statement: {}", e))?;

            let result = stmt
                .query_row(params![id], |row| {
                    Ok(DatabaseMetadata {
                        id: row.get(0)?,
                        connection_id: row.get(1)?,
                        name: row.get(2)?,
                        path: row.get(3)?,
                        created_at: row.get(4)?,
                        updated_at: row.get(5)?,
                        metadata: row.get(6)?,
                    })
                })
                .optional()
                .map_err(|e| format!("Failed to query: {}", e))?;

            Ok(result)
        })
        .await
        .map_err(|e| format!("get_database task failed: {:?}", e))?
  }

  pub async fn update_database(
    id: i64,
    name: &str,
    path: Option<&str>,
    metadata: Option<&str>,
  ) -> Result<DatabaseMetadata, String> {
    let db_path = Self::path();
    let now = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map_err(|e| format!("Time error: {}", e))?
      .as_secs() as i64;

    let name_owned = name.to_string();
    let path_owned = path.map(|p| p.to_string());
    let metadata_owned = metadata.map(|m| m.to_string());

    tokio::task::spawn_blocking(move || {
            let conn = Connection::open(&db_path)
                .map_err(|e| format!("Failed to open database: {}", e))?;

            conn.execute(
                "UPDATE database_metadata SET name = ?1, path = ?2, updated_at = ?3, metadata = ?4 WHERE id = ?5",
                params![name_owned, path_owned, now, metadata_owned, id],
            )
            .map_err(|e| format!("Failed to update database: {}", e))?;

            let mut stmt = conn
                .prepare("SELECT id, connection_id, name, path, created_at, updated_at, metadata FROM database_metadata WHERE id = ?1")
                .map_err(|e| format!("Failed to prepare statement: {}", e))?;

            stmt.query_row(params![id], |row| {
                Ok(DatabaseMetadata {
                    id: row.get(0)?,
                    connection_id: row.get(1)?,
                    name: row.get(2)?,
                    path: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                    metadata: row.get(6)?,
                })
            })
            .map_err(|e| format!("Database not found after update: {}", e))
        })
        .await
        .map_err(|e| format!("update_database task failed: {:?}", e))?
  }

  pub async fn delete_database(id: i64) -> Result<(), String> {
    let db_path = Self::path();

    tokio::task::spawn_blocking(move || {
      let conn =
        Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

      conn
        .execute("DELETE FROM database_metadata WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete database: {}", e))?;

      Ok(())
    })
    .await
    .map_err(|e| format!("delete_database task failed: {:?}", e))?
  }

  pub async fn delete_connection_databases(connection_id: &str) -> Result<(), String> {
    let db_path = Self::path();
    let conn_id = connection_id.to_string();

    tokio::task::spawn_blocking(move || {
      let conn =
        Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

      conn
        .execute(
          "DELETE FROM database_metadata WHERE connection_id = ?1",
          params![conn_id],
        )
        .map_err(|e| format!("Failed to delete connection databases: {}", e))?;

      Ok(())
    })
    .await
    .map_err(|e| format!("delete_connection_databases task failed: {:?}", e))?
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotResult {
  pub data: String,
  pub width: u32,
  pub height: u32,
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
  log::debug!("command = init_decentralized_storage [COMMAND_ENTRY]");
  match DecentralizedStorage::init().await {
    Ok(()) => {
      timer.finish(&ResponseModel::success(()));
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
  log::debug!(
    "command = save_database_metadata, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  match DecentralizedStorage::save_database(
    &connection_id,
    &name,
    path.as_deref(),
    metadata.as_deref(),
  )
  .await
  {
    Ok(result) => {
      timer.finish(&ResponseModel::success(&result));
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
  log::debug!(
    "command = list_databases_metadata, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  match tokio::time::timeout(
    std::time::Duration::from_secs(LIST_TIMEOUT_SECS),
    DecentralizedStorage::list_databases(&connection_id),
  )
  .await
  {
    Ok(Ok(result)) => {
      timer.finish(&ResponseModel::success(&result));
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
  log::debug!(
    "command = get_database_metadata, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  match DecentralizedStorage::get_database(id).await {
    Ok(result) => {
      timer.finish(&ResponseModel::success(&result));
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
  log::debug!(
    "command = update_database_metadata, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  match DecentralizedStorage::update_database(id, &name, path.as_deref(), metadata.as_deref()).await
  {
    Ok(result) => {
      timer.finish(&ResponseModel::success(&result));
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
  log::debug!(
    "command = delete_database_metadata, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  match DecentralizedStorage::delete_database(id).await {
    Ok(()) => {
      timer.finish(&ResponseModel::success(()));
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
  log::debug!(
    "command = delete_connection_databases_metadata, params = {} [COMMAND_ENTRY]",
    redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
  );
  match DecentralizedStorage::delete_connection_databases(&connection_id).await {
    Ok(()) => {
      timer.finish(&ResponseModel::success(()));
      Ok(())
    }
    Err(e) => {
      timer.finish_error(&e);
      Err(e)
    }
  }
}

#[tauri::command]
pub async fn get_system_status() -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("get_system_status");
  log::debug!("command = get_system_status, [COMMAND_ENTRY]");
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
    ResponseModel::error(format!("Task join error: {}", e))
  })?;

  timer.finish(&ResponseModel::success(&sys));
  Ok(ResponseModel::success(sys))
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub async fn capture_screenshot(_app: AppHandle) -> Result<ScreenshotResult, String> {
  let timer = DataflowTimer::new("capture_screenshot");
  use std::process::Command;

  let screenshot_path = "/tmp/zenithdb_screenshot.png";

  let output = Command::new("gnome-screenshot")
    .args(["-f", screenshot_path])
    .output();

  if output.is_err() {
    Command::new("scrot")
      .args(["-s", screenshot_path])
      .output()
      .map_err(|e| {
        timer
          .clone()
          .finish_error(&format!("Failed to capture screenshot: {}", e));
        format!("Failed to capture screenshot: {}", e)
      })?;
  }

  let img_data = fs::read(screenshot_path).map_err(|e| {
    timer
      .clone()
      .finish_error(&format!("Failed to read screenshot: {}", e));
    format!("Failed to read screenshot: {}", e)
  })?;
  let img = image::load_from_memory(&img_data).map_err(|e| {
    timer
      .clone()
      .finish_error(&format!("Failed to decode image: {}", e));
    format!("Failed to decode image: {}", e)
  })?;
  let width = img.width();
  let height = img.height();
  let rgba = img.to_rgba8();
  let encoded = STANDARD.encode(rgba.as_raw());

  let _ = fs::remove_file(screenshot_path);

  log::debug!(
    "command = capture_screenshot, width = {}, height = {}",
    width,
    height
  );
  Ok(ScreenshotResult {
    data: encoded,
    width,
    height,
  })
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn capture_screenshot(app: AppHandle) -> Result<ScreenshotResult, String> {
  let timer = DataflowTimer::new("capture_screenshot");
  use std::ptr::null_mut;

  let hwnd = app
    .get_webview_window("main")
    .ok_or_else(|| {
      timer.finish_error("Could not find main window");
      "Could not find main window".to_string()
    })?
    .hwnd()
    .map_err(|e| {
      timer.finish_error(&format!("Failed to get HWND: {}", e));
      format!("Failed to get HWND: {}", e)
    })?
    .0 as isize;

  unsafe {
    let hdc = winapi::um::winuser::GetDC(hwnd as *mut _);
    if hdc.is_null() {
      timer.finish_error("Failed to get device context");
      return Err("Failed to get device context".to_string());
    }

    let width = winapi::um::wingdi::GetDeviceCaps(hdc, winapi::um::wingdi::HORZRES);
    let height = winapi::um::wingdi::GetDeviceCaps(hdc, winapi::um::wingdi::VERTRES);

    let mut bmp_data: Vec<u8> = vec![0; (width * height * 4) as usize];
    let bmp_info = winapi::um::wingdi::BITMAPINFO {
      bmiHeader: winapi::um::wingdi::BITMAPINFOHEADER {
        biSize: std::mem::size_of::<winapi::um::wingdi::BITMAPINFOHEADER>() as u32,
        biWidth: width as i32,
        biHeight: -(height as i32),
        biPlanes: 1,
        biBitCount: 32,
        biCompression: winapi::um::wingdi::BI_RGB,
        ..Default::default()
      },
      ..Default::default()
    };

    let res = winapi::um::wingdi::GetDIBits(
      hdc,
      null_mut(),
      height as u32,
      bmp_data.as_mut_ptr() as *mut _,
      &bmp_info,
      winapi::um::wingdi::DIB_RGB_COLORS,
    );

    winapi::um::winuser::ReleaseDC(hwnd as *mut _, hdc);

    if res == 0 {
      timer.finish_error("Failed to get bitmap bits");
      return Err("Failed to get bitmap bits".to_string());
    }

    let encoded = STANDARD.encode(&bmp_data);

    log::debug!(
      "command = capture_screenshot, width = {}, height = {}, [DATAFLOW]",
      width,
      height
    );
    Ok(ScreenshotResult {
      data: encoded,
      width: width as u32,
      height: height as u32,
    })
  }
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn capture_screenshot(_app: AppHandle) -> Result<ScreenshotResult, String> {
  let timer = DataflowTimer::new("capture_screenshot");
  use std::process::Command;

  let screenshot_path = "/tmp/zenithdb_screenshot.png";

  Command::new("screencapture")
    .args(["-x", screenshot_path])
    .output()
    .map_err(|e| {
      timer
        .clone()
        .finish_error(&format!("Failed to capture screenshot: {}", e));
      format!("Failed to capture screenshot: {}", e)
    })?;

  let img_data = fs::read(screenshot_path).map_err(|e| {
    timer
      .clone()
      .finish_error(&format!("Failed to read screenshot: {}", e));
    format!("Failed to read screenshot: {}", e)
  })?;
  let img = image::load_from_memory(&img_data).map_err(|e| {
    timer
      .clone()
      .finish_error(&format!("Failed to decode image: {}", e));
    format!("Failed to decode image: {}", e)
  })?;
  let width = img.width();
  let height = img.height();
  let rgba = img.to_rgba8();
  let encoded = STANDARD.encode(rgba.as_raw());

  let _ = fs::remove_file(screenshot_path);

  log::debug!(
    "command = capture_screenshot, width = {}, height = {}",
    width,
    height
  );
  Ok(ScreenshotResult {
    data: encoded,
    width,
    height,
  })
}

#[tauri::command]
pub async fn save_log_file(filename: String, data: String) -> Result<ResponseModel, ResponseModel> {
  let timer = DataflowTimer::new("save_log_file");
  let logs_dir = get_logs_dir()?;
  let file_path = logs_dir.join(&filename);

  fs::write(&file_path, &data).map_err(|e| {
    timer
      .clone()
      .finish_error(&format!("Failed to write log file: {}", e));
    ResponseModel::error(format!("Failed to write log file: {}", e))
  })?;

  log::debug!("command = save_log_file, filename = {}", filename);
  Ok(ResponseModel::success(
    file_path.to_string_lossy().to_string(),
  ))
}

#[tauri::command]
pub async fn append_log_file(data: String) -> Result<ResponseModel, ResponseModel> {
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
      ResponseModel::error(format!("Failed to open log file: {}", e))
    })?;

  writeln!(file, "{}", data).map_err(|e| {
    timer
      .clone()
      .finish_error(&format!("Failed to write to log file: {}", e));
    ResponseModel::error(format!("Failed to write to log file: {}", e))
  })?;

  log::debug!("command = append_log_file, date = {}", date);
  Ok(ResponseModel::success(
    file_path.to_string_lossy().to_string(),
  ))
}
