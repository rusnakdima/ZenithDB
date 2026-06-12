use crate::logger::DataflowTimer;
use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use tauri::AppHandle;

fn get_logs_dir() -> Result<PathBuf, String> {
  let home = dirs::home_dir().ok_or("Could not find home directory")?;
  let logs_dir = home.join(".zenithdb").join("logs");
  if !logs_dir.exists() {
    fs::create_dir_all(&logs_dir).map_err(|e| format!("Failed to create logs directory: {}", e))?;
  }
  Ok(logs_dir)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotResult {
  pub data: String,
  pub width: u32,
  pub height: u32,
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

  tracing::debug!(command = "capture_screenshot", width = %width, height = %height, "[DATAFLOW]");
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
      0,
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

    tracing::debug!(command = "capture_screenshot", width = %width, height = %height, "[DATAFLOW]");
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

  tracing::debug!(command = "capture_screenshot", width = %width, height = %height, "[DATAFLOW]");
  Ok(ScreenshotResult {
    data: encoded,
    width,
    height,
  })
}

#[tauri::command]
pub async fn save_log_file(filename: String, data: String) -> Result<String, String> {
  let timer = DataflowTimer::new("save_log_file");
  let logs_dir = get_logs_dir()?;
  let file_path = logs_dir.join(&filename);

  fs::write(&file_path, &data).map_err(|e| {
    timer
      .clone()
      .finish_error(&format!("Failed to write log file: {}", e));
    format!("Failed to write log file: {}", e)
  })?;

  tracing::debug!(command = "save_log_file", filename = %filename, "[DATAFLOW]");
  Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn append_log_file(data: String) -> Result<String, String> {
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

  tracing::debug!(command = "append_log_file", date = %date, "[DATAFLOW]");
  Ok(file_path.to_string_lossy().to_string())
}
