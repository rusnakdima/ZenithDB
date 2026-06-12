use crate::models::response::ResponseModel;
use std::time::Instant;
use tracing::Level;
use tracing_subscriber::{
  fmt::{self, format::FmtSpan},
  layer::SubscriberExt,
  util::SubscriberInitExt,
  EnvFilter,
};

pub fn init_logger() -> Result<(), String> {
  let log_enabled = std::env::var("ZENITH_LOG")
    .map(|v| v.to_lowercase() != "false")
    .unwrap_or(true);

  if !log_enabled {
    tracing_subscriber::registry()
      .with(EnvFilter::new("off"))
      .init();
    return Ok(());
  }

  let debug_disabled = std::env::var("ZENITH_LOG_DEBUG")
    .map(|v| v.to_lowercase() == "false")
    .unwrap_or(false);
  let info_disabled = std::env::var("ZENITH_LOG_INFO")
    .map(|v| v.to_lowercase() == "false")
    .unwrap_or(false);
  let warn_disabled = std::env::var("ZENITH_LOG_WARN")
    .map(|v| v.to_lowercase() == "false")
    .unwrap_or(false);
  let error_disabled = std::env::var("ZENITH_LOG_ERROR")
    .map(|v| v.to_lowercase() == "false")
    .unwrap_or(false);

  let any_toggle_set = debug_disabled || info_disabled || warn_disabled || error_disabled;

  let env_filter = if any_toggle_set {
    let mut levels = Vec::new();
    if !debug_disabled {
      levels.push("debug");
    }
    if !info_disabled {
      levels.push("info");
    }
    if !warn_disabled {
      levels.push("warn");
    }
    if !error_disabled {
      levels.push("error");
    }
    EnvFilter::new(levels.join(","))
  } else {
    let log_level = std::env::var("ZENITH_LOG_LEVEL").unwrap_or_else(|_| "debug".to_string());
    EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(&log_level))
  };

  let console_layer = fmt::layer()
    .with_span_events(FmtSpan::CLOSE)
    .with_target(true);

  tracing_subscriber::registry()
    .with(env_filter)
    .with(console_layer)
    .init();
  return Ok(());
}

pub fn set_log_level(level: Level) {
  tracing::subscriber::set_global_default(
    tracing_subscriber::registry()
      .with(EnvFilter::new(level.to_string()))
      .with(
        fmt::layer()
          .with_span_events(FmtSpan::CLOSE)
          .with_target(true),
      ),
  )
  .unwrap();
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

#[macro_export]
macro_rules! dataflow_snapshot {
  ($command:expr, $params:expr, $result:expr) => {
    tracing::debug!(
      command = %$command,
      params = %crate::logger::redact_sensitive_data(&serde_json::to_string(&$params).unwrap_or_default()),
      result_status = %format!("{:?}", $result.status),
      result_message = %$result.message,
      "[DATAFLOW_SNAPSHOT]"
    );
  };
  ($command:expr, $params:expr, $result:expr, $duration_ms:expr) => {
    tracing::debug!(
      command = %$command,
      params = %crate::logger::redact_sensitive_data(&serde_json::to_string(&$params).unwrap_or_default()),
      result_status = %format!("{:?}", $result.status),
      result_message = %$result.message,
      duration_ms = %$duration_ms,
      "[DATAFLOW_SNAPSHOT]"
    );
  };
  ($command:expr, $params:expr, $error:expr, $duration_ms:expr) => {
    tracing::debug!(
      command = %$command,
      params = %crate::logger::redact_sensitive_data(&serde_json::to_string(&$params).unwrap_or_default()),
      error = %$error,
      duration_ms = %$duration_ms,
      "[DATAFLOW_SNAPSHOT_ERROR]"
    );
  };
}

#[derive(Clone)]
pub struct DataflowTimer {
  start: Instant,
  command: String,
}

impl DataflowTimer {
  pub fn new(command: &str) -> Self {
    tracing::debug!(command = %command, "[DATAFLOW_COMMAND_START]");
    Self {
      start: Instant::now(),
      command: command.to_string(),
    }
  }

  pub fn finish(self, result: &ResponseModel) {
    let elapsed = self.start.elapsed().as_millis() as u64;
    dataflow_snapshot!(self.command, {}, result, elapsed);
  }

  pub fn finish_error(self, error: &str) {
    let elapsed = self.start.elapsed().as_millis() as u64;
    tracing::debug!(
      command = %self.command,
      error = %error,
      duration_ms = %elapsed,
      "[DATAFLOW_COMMAND_ERROR]"
    );
  }
}
