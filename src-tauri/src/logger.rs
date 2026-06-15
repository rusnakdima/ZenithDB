use crate::models::response::ResponseModel;
use std::time::Instant;

pub fn init_logger() -> Result<(), String> {
  tauri_logger::init()
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
