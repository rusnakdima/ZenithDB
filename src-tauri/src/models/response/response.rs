use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Status {
  Success,
  Created,
  Updated,
  Deleted,
  Error,
  ValidationError,
  NotFound,
  Unauthorized,
  Forbidden,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct Response<T = serde_json::Value> {
  pub status: Status,
  pub message: String,
  pub data: T,
}

impl<T> Response<T> {
  pub fn success(data: T) -> Self {
    Self {
      status: Status::Success,
      message: String::new(),
      data,
    }
  }

  pub fn created(data: T) -> Self {
    Self {
      status: Status::Created,
      message: "Created successfully".into(),
      data,
    }
  }

  pub fn updated(data: T) -> Self {
    Self {
      status: Status::Updated,
      message: "Updated successfully".into(),
      data,
    }
  }

  pub fn deleted(data: T) -> Self {
    Self {
      status: Status::Deleted,
      message: "Deleted successfully".into(),
      data,
    }
  }
}

impl Response<serde_json::Value> {
  pub fn error(message: impl Into<String>) -> Self {
    Self {
      status: Status::Error,
      message: message.into(),
      data: serde_json::Value::Null,
    }
  }

  pub fn validation_error(message: impl Into<String>) -> Self {
    Self {
      status: Status::ValidationError,
      message: message.into(),
      data: serde_json::Value::Null,
    }
  }

  pub fn not_found(entity: &str) -> Self {
    Self {
      status: Status::NotFound,
      message: format!("{} not found", entity),
      data: serde_json::Value::Null,
    }
  }

  pub fn unauthorized() -> Self {
    Self {
      status: Status::Unauthorized,
      message: "Unauthorized".into(),
      data: serde_json::Value::Null,
    }
  }

  pub fn forbidden() -> Self {
    Self {
      status: Status::Forbidden,
      message: "Forbidden".into(),
      data: serde_json::Value::Null,
    }
  }

  pub fn success_empty() -> Self {
    Self {
      status: Status::Success,
      message: String::new(),
      data: serde_json::Value::Null,
    }
  }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ResponseModel {
  pub status: Status,
  pub message: String,
  pub data: serde_json::Value,
}

impl Default for ResponseModel {
  fn default() -> Self {
    Self {
      status: Status::Success,
      message: String::new(),
      data: serde_json::Value::Null,
    }
  }
}

impl ResponseModel {
  pub fn success<T: Serialize>(data: T) -> Self {
    Self {
      status: Status::Success,
      message: String::new(),
      data: serde_json::to_value(data).unwrap_or(serde_json::Value::Null),
    }
  }

  pub fn success_message(message: impl Into<String>) -> Self {
    Self {
      status: Status::Success,
      message: message.into(),
      data: serde_json::Value::Null,
    }
  }

  pub fn error(message: impl Into<String>) -> Self {
    Self {
      status: Status::Error,
      message: message.into(),
      data: serde_json::Value::Null,
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
