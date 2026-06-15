mod commands;
mod constants;
mod errors;
mod infrastructure;
mod logger;
mod models;
mod services;
mod state;
mod types;

use tauri::Manager;

use commands::connection_command::{
  check_health, delete_connection, get_connection, list_connections, save_connection,
  test_connection, test_connection_status, update_connection,
};
use commands::database_command::{
  create_database, database_list, delete_database, rename_database,
};
use commands::query_command::{
  query_delete, query_execute, query_raw, query_save, query_server_version,
};
use commands::schema_command::{
  collection_create, collection_drop, collection_list, collection_rename, collection_stats,
  describe_collection,
};
use commands::settings_command::{
  append_log_file, capture_screenshot, delete_connection_databases_metadata,
  delete_database_metadata, get_database_metadata, get_system_status, init_decentralized_storage,
  list_databases_metadata, save_database_metadata, save_log_file, update_database_metadata,
};

use state::AppState;

pub fn run() -> Result<(), String> {
  logger::init_logger();

  std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
  std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");

  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_mcp_bridge::init())
    .setup(|app| {
      let app_state =
        tauri::async_runtime::block_on(AppState::new(app.handle().clone())).map_err(|e| {
          log::error!("Failed to create AppState: {}", e);
          e
        })?;
      app.manage(app_state);
      log::info!("AppState initialized");
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      save_connection,
      list_connections,
      delete_connection,
      update_connection,
      test_connection,
      test_connection_status,
      check_health,
      get_connection,
      collection_list,
      collection_stats,
      collection_create,
      collection_drop,
      collection_rename,
      database_list,
      query_execute,
      query_save,
      query_delete,
      query_raw,
      query_server_version,
      create_database,
      rename_database,
      delete_database,
      describe_collection,
      init_decentralized_storage,
      save_database_metadata,
      list_databases_metadata,
      get_database_metadata,
      update_database_metadata,
      delete_database_metadata,
      delete_connection_databases_metadata,
      get_system_status,
      capture_screenshot,
      save_log_file,
      append_log_file,
    ])
    .run(tauri::generate_context!())
    .map_err(|e| e.to_string())?;
  Ok(())
}
