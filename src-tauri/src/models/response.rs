use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
pub enum Status {
  Success,
  Error,
  Info,
  Warning,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DataValue {
  String(String),
  Number(f64),
  Bool(bool),
  Array(Vec<serde_json::Value>),
  Object(serde_json::Value),
  Empty,
}

impl DataValue {
  pub fn from_serialize<T: Serialize>(value: T) -> Self {
    match serde_json::to_value(value) {
      Ok(serde_json::Value::Null) => DataValue::Empty,
      Ok(serde_json::Value::String(s)) => DataValue::String(s),
      Ok(serde_json::Value::Number(n)) => {
        if let Some(f) = n.as_f64() {
          DataValue::Number(f)
        } else {
          DataValue::Object(serde_json::Value::Number(n))
        }
      }
      Ok(serde_json::Value::Bool(b)) => DataValue::Bool(b),
      Ok(serde_json::Value::Array(arr)) => DataValue::Array(arr),
      Ok(other) => DataValue::Object(other),
      Err(_) => DataValue::Empty,
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseModel {
  pub status: Status,
  pub message: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub data: Option<DataValue>,
}

impl ResponseModel {
  pub fn success<T: Serialize>(data: T) -> Self {
    Self {
      status: Status::Success,
      message: String::new(),
      data: Some(DataValue::from_serialize(data)),
    }
  }

  pub fn success_message(message: impl Into<String>) -> Self {
    Self {
      status: Status::Success,
      message: message.into(),
      data: None,
    }
  }

  pub fn error(message: impl Into<String>) -> Self {
    Self {
      status: Status::Error,
      message: message.into(),
      data: None,
    }
  }
}

impl From<String> for ResponseModel {
  fn from(s: String) -> Self {
    ResponseModel::error(s)
  }
}

impl From<&str> for ResponseModel {
  fn from(s: &str) -> Self {
    ResponseModel::error(s)
  }
}
