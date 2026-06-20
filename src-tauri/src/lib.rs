mod commands;
mod constants;
mod entities;
mod errors;
mod models;
mod repositories;
mod services;
mod state;
mod utils;
use commands::connection_command::{
  check_health, delete_connection, get_connection, list_connections, save_connection,
  test_connection, test_connection_status, update_connection,
};
use commands::database_command::{
  create_database, database_list, delete_database, rename_database,
};
use commands::ipc_commands::{
  begin_transaction, commit_transaction, create_index, delete_document, drop_index, get_version,
  initialize_app, insert_document, is_connected, rebuild_index, rollback_transaction,
  soft_delete_document, update_document,
};
use commands::query_command::{
  query_delete, query_execute, query_raw, query_save, query_server_version,
};
use commands::schema_command::{
  collection_create, collection_drop, collection_list, collection_rename, collection_stats,
  describe_collection,
};
use commands::screenshot_command::capture_screenshot;
use commands::settings_command::{
  append_log_file, delete_connection_databases_metadata, delete_database_metadata,
  get_database_metadata, get_system_status, init_decentralized_storage, list_databases_metadata,
  save_database_metadata, save_log_file, update_database_metadata,
};
use state::AppState;
use tauri::Manager;
pub fn run() -> Result<(), String> {
  std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
  std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_mcp_bridge::init())
    .setup(|app| {
      let app_state =
        tauri::async_runtime::block_on(AppState::new(app.handle().clone())).map_err(|e| e)?;
      app.manage(app_state);
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
      initialize_app,
      get_version,
      is_connected,
      rebuild_index,
      create_index,
      drop_index,
      insert_document,
      update_document,
      delete_document,
      soft_delete_document,
      begin_transaction,
      commit_transaction,
      rollback_transaction,
    ])
    .run(tauri::generate_context!())
    .map_err(|e| e.to_string())?;
  Ok(())
}
