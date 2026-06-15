use crate::services::connection_service::ConnectionService;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::Mutex;

pub struct AppState {
  pub connection_service: Arc<ConnectionService>,
  #[allow(dead_code)]
  pub app_handle: Arc<Mutex<AppHandle>>,
}

impl AppState {
  pub fn new(app_handle: AppHandle) -> Result<Self, String> {
    let connection_service = ConnectionService::get_instance();
    Ok(Self {
      connection_service,
      app_handle: Arc::new(Mutex::new(app_handle)),
    })
  }
}
