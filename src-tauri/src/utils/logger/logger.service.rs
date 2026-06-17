use log::{debug, error, info, warn, LevelFilter};
use std::time::Instant;

pub use crate::utils::logger::logger_backend::init_log_system;

pub fn init_logger(app_name: &str, level: LevelFilter) -> Result<(), log::SetLoggerError> {
  unsafe { init_log_system(app_name, level) }
}

#[inline]
pub fn log_debug(message: &str) {
  debug!("{}", message);
}

#[inline]
pub fn log_warn(message: &str) {
  warn!("{}", message);
}

#[inline]
pub fn log_error(message: &str) {
  error!("{}", message);
}

#[inline]
pub fn log_info(message: &str) {
  info!("{}", message);
}

#[derive(Clone)]
pub struct DataflowTimer {
  name: String,
  start: Instant,
}

impl DataflowTimer {
  pub fn new(name: &str) -> Self {
    Self {
      name: name.to_string(),
      start: Instant::now(),
    }
  }

  pub fn elapsed_ms(&self) -> u128 {
    self.start.elapsed().as_millis()
  }

  pub fn finish<T>(&self, result: &T) {
    debug!(
      "[{}] completed successfully in {}ms",
      self.name,
      self.elapsed_ms()
    );
  }

  pub fn finish_error(&self, error: &str) {
    error!(
      "[{}] failed after {}ms: {}",
      self.name,
      self.elapsed_ms(),
      error
    );
  }
}

impl Drop for DataflowTimer {
  fn drop(&mut self) {
    debug!("[{}] completed in {}ms", self.name, self.elapsed_ms());
  }
}

pub fn redact_sensitive_data(input: &str) -> String {
  let sensitive_patterns = [
    r"(?i)(password|pwd|passwd|secret)\s*[=:]\s*[^,\s]+",
    r"(?i)(api_key|apikey|api-key|token|auth_token|access_token)\s*[=:]\s*[^,\s]+",
    r"(?i)(bearer\s+)[^\s]+",
    r"\b\d{13,16}\b",
    r"(?i)(credit.*card|card.*number|cvv|cvc)\s*[=:]\s*[^,\s]+",
  ];

  let mut result = input.to_string();
  for pattern in sensitive_patterns {
    if let Ok(re) = regex::Regex::new(pattern) {
      result = re.replace_all(&result, "[REDACTED]").to_string();
    }
  }
  result
}
