mod commands;
mod infrastructure;
mod logger;
mod models;
mod services;
mod state;
mod types;

use tauri::Manager;

use commands::admin::{
  create_collection, drop_collection, execute_raw, get_server_version, rename_collection,
};
use commands::connection::{
  check_health, delete_connection, get_connection, list_connections, save_connection,
  test_connection, test_connection_status, update_connection,
};
use commands::data::{delete_row, query_data, save_row};
use commands::dataflow::{append_log_file, capture_screenshot, save_log_file};
use commands::decentralization::{
  delete_connection_databases_metadata, delete_database_metadata, get_database_metadata,
  init_decentralized_storage, list_databases_metadata, save_database_metadata,
  update_database_metadata,
};
use commands::schema::{
  create_database, delete_database, describe_collection, get_collection_stats, list_collections,
  rename_database,
};
use commands::system::get_system_status;

use commands::entities::collection::routes as collection_routes;
use commands::entities::connection::routes as connection_routes;
use commands::entities::database::routes as database_routes;
use commands::entities::query::routes as query_routes;

use state::AppState;

pub fn run() -> Result<(), String> {
  logger::init_logger()?;

  std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
  std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");

  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_mcp_bridge::init())
    .setup(|app| {
      let app_state = AppState::new().map_err(|e| {
        tracing::error!("Failed to create AppState: {}", e);
        e
      })?;
      app.manage(app_state);
      tracing::info!("AppState initialized");
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
      list_collections,
      create_database,
      rename_database,
      delete_database,
      describe_collection,
      get_collection_stats,
      query_data,
      save_row,
      delete_row,
      create_collection,
      drop_collection,
      rename_collection,
      execute_raw,
      get_server_version,
      get_system_status,
      connection_routes::connection_list,
      connection_routes::connection_get,
      connection_routes::connection_create,
      connection_routes::connection_update,
      connection_routes::connection_delete,
      connection_routes::connection_test,
      connection_routes::connection_test_status,
      init_decentralized_storage,
      save_database_metadata,
      list_databases_metadata,
      get_database_metadata,
      update_database_metadata,
      delete_database_metadata,
      delete_connection_databases_metadata,
      collection_routes::collection_list,
      collection_routes::collection_describe,
      collection_routes::collection_stats,
      collection_routes::collection_create,
      collection_routes::collection_drop,
      collection_routes::collection_rename,
      database_routes::database_list,
      query_routes::query_execute,
      query_routes::query_save,
      query_routes::query_delete,
      query_routes::query_raw,
      query_routes::query_server_version,
      capture_screenshot,
      save_log_file,
      append_log_file,
    ])
    .run(tauri::generate_context!())
    .map_err(|e| e.to_string())?;
  Ok(())
}
