pub use tauri_shared::response::{Response, Status};

use serde_json::Value;

pub type ResponseModel = Response<Value>;

pub fn success(message: impl Into<String>, data: Value) -> ResponseModel {
  ResponseModel::success(data, Some(&*message.into()))
}

pub fn created(message: impl Into<String>, data: Value) -> ResponseModel {
  ResponseModel {
    status: Status::Created,
    message: message.into(),
    data: Some(data),
  }
}

pub fn updated(message: impl Into<String>, data: Value) -> ResponseModel {
  ResponseModel {
    status: Status::Updated,
    message: message.into(),
    data: Some(data),
  }
}

pub fn deleted(message: impl Into<String>, data: Value) -> ResponseModel {
  ResponseModel {
    status: Status::Deleted,
    message: message.into(),
    data: Some(data),
  }
}

pub fn info(message: impl Into<String>, data: Value) -> ResponseModel {
  ResponseModel {
    status: Status::Info,
    message: message.into(),
    data: Some(data),
  }
}

pub fn warning(message: impl Into<String>, data: Value) -> ResponseModel {
  ResponseModel {
    status: Status::Warning,
    message: message.into(),
    data: Some(data),
  }
}

pub fn duplicate(message: impl Into<String>, data: Value) -> ResponseModel {
  ResponseModel {
    status: Status::Duplicate,
    message: message.into(),
    data: Some(data),
  }
}

pub fn error(status: Status, message: impl Into<String>) -> ResponseModel {
  ResponseModel {
    status,
    message: message.into(),
    data: None,
  }
}

pub fn validation_error(message: impl Into<String>) -> ResponseModel {
  ResponseModel::validation_error(message)
}

pub fn not_found(entity: impl Into<String>) -> ResponseModel {
  ResponseModel::not_found(entity)
}

pub fn unauthorized() -> ResponseModel {
  ResponseModel::unauthorized("Unauthorized")
}

pub fn forbidden() -> ResponseModel {
  ResponseModel::forbidden("Forbidden")
}

pub fn success_empty() -> ResponseModel {
  ResponseModel {
    status: Status::Success,
    message: String::new(),
    data: Some(Value::Null),
  }
}

pub fn success_message(message: impl Into<String>) -> ResponseModel {
  ResponseModel {
    status: Status::Success,
    message: message.into(),
    data: Some(Value::Null),
  }
}

pub type ResponseStatus = Status;
