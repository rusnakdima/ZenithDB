use crate::models::response::ResponseModel;
use log::{LevelFilter, Log, Metadata, Record};
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;

pub struct AppLogger {
  level: LevelFilter,
  file: Mutex<Option<File>>,
  log_dir: PathBuf,
}

impl AppLogger {
  pub fn new(log_dir: PathBuf) -> Self {
    Self {
      level: LevelFilter::Info,
      file: Mutex::new(None),
      log_dir,
    }
  }

  pub fn init(&self) {
    std::fs::create_dir_all(&self.log_dir).ok();
    let log_file = self.log_dir.join(format!(
      "zenithdb_{}.log",
      chrono::Local::now().format("%Y%m%d")
    ));
    let file = OpenOptions::new()
      .create(true)
      .append(true)
      .open(&log_file)
      .ok();
    *self.file.lock().unwrap() = file;
    let logger: &'static dyn Log = unsafe { &*(self as *const AppLogger as *const dyn Log) };
    log::set_logger(logger).unwrap();
    log::set_max_level(self.level);
  }
}

impl Log for AppLogger {
  fn log(&self, record: &Record) {
    if record.level() > self.level {
      return;
    }
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let msg = format!(
      "[{}] {} - {}: {}\n",
      timestamp,
      record.level(),
      record.target(),
      record.args()
    );
    eprint!("{}", msg);
    if let Ok(mut guard) = self.file.lock() {
      if let Some(ref mut f) = *guard {
        let _ = f.write_all(msg.as_bytes());
        let _ = f.flush();
      }
    }
  }

  fn enabled(&self, metadata: &Metadata) -> bool {
    metadata.level() <= self.level
  }

  fn flush(&self) {}
}

pub fn init_logger() {
  let log_dir = dirs::data_local_dir()
    .unwrap_or_else(|| PathBuf::from("."))
    .join("zenithdb")
    .join("logs");
  let logger = AppLogger::new(log_dir);
  logger.init();
}

pub fn redact_sensitive_data(value: &str) -> String {
  let sensitive_keys = [
    "password",
    "secret",
    "token",
    "credentials",
    "uri",
    "connectionString",
  ];
  let mut result = value.to_string();
  for key in sensitive_keys {
    let pattern = format!(r#""{}":"[^"]*"#, key);
    let redaction = format!(r#""{}":"[REDACTED]"#, key);
    result = result.replace(&pattern, &redaction);
    let pattern2 = format!(r#""{}":\s*"[^"]*""#, key);
    let redaction2 = format!(r#""{}": "[REDACTED]""#, key);
    result = result.replace(&pattern2, &redaction2);
  }
  result
}

#[derive(Clone)]
pub struct DataflowTimer {
  start: Instant,
  command: String,
}

impl DataflowTimer {
  pub fn new(command: &str) -> Self {
    log::debug!("command = {}, [DATAFLOW_COMMAND_START]", command);
    Self {
      start: Instant::now(),
      command: command.to_string(),
    }
  }

  pub fn finish(self, result: &ResponseModel) {
    let elapsed = self.start.elapsed().as_millis() as u64;
    crate::dataflow_snapshot!(self.command, serde_json::json!({}), result, elapsed);
  }

  pub fn finish_error(self, error: &str) {
    let elapsed = self.start.elapsed().as_millis() as u64;
    log::debug!(
      "command = {}, error = {}, duration_ms = {} [DATAFLOW_COMMAND_ERROR]",
      self.command,
      error,
      elapsed
    );
  }
}

#[macro_export]
macro_rules! dataflow_snapshot {
    ($command:expr, $params:expr, $result:expr) => {
        log::debug!(
            "command = {}, params = {}, result_status = {:?}, result_message = {} [DATAFLOW_SNAPSHOT]",
            $command,
            crate::logger::redact_sensitive_data(&serde_json::to_string(&$params).unwrap_or_default()),
            $result.status,
            $result.message
        );
    };
    ($command:expr, $params:expr, $result:expr, $duration_ms:expr) => {
        log::debug!(
            "command = {}, params = {}, result_status = {:?}, result_message = {}, duration_ms = {} [DATAFLOW_SNAPSHOT]",
            $command,
            crate::logger::redact_sensitive_data(&serde_json::to_string(&$params).unwrap_or_default()),
            $result.status,
            $result.message,
            $duration_ms
        );
    };
    ($command:expr, $params:expr, $error:expr, $duration_ms:expr) => {
        log::debug!(
            "command = {}, params = {}, error = {}, duration_ms = {} [DATAFLOW_SNAPSHOT_ERROR]",
            $command,
            crate::logger::redact_sensitive_data(&serde_json::to_string(&$params).unwrap_or_default()),
            $error,
            $duration_ms
        );
    };
}
