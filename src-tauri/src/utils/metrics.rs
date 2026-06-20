use std::time::Instant;
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
  pub fn finish_error(&self, _error: &str) {}
  pub fn finish_success(&self) {}
}
pub fn redact_sensitive_data(data: &str) -> String {
  let sensitive_patterns = ["password", "token", "secret", "api_key", "authorization"];
  let mut result = data.to_string();
  for pattern in sensitive_patterns {
    let redaction = format!("\"{}\":\"[REDACTED]\"", pattern);
    let regex_pattern = format!(r#""{}":"[^"]*""#, pattern);
    result = result.replace(&regex_pattern, &redaction);
  }
  result
}
