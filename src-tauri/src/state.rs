use crate::services::connection_service::ConnectionService;
use std::sync::Arc;

pub struct AppState {
  pub connection_service: Arc<ConnectionService>,
}

impl AppState {
  pub fn new() -> Result<Self, String> {
    let connection_service = ConnectionService::get_instance();
    Ok(Self { connection_service })
  }
}

impl Default for AppState {
  fn default() -> Self {
    Self::new().unwrap()
  }
}
