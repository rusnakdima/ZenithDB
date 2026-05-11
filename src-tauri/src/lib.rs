mod commands;

use commands::admin::{execute_raw, get_server_version};
use commands::connection::{
  delete_connection, get_connection, list_connections, save_connection, test_connection,
  test_connection_status, update_connection,
};
use commands::data::query_data;
use commands::metrics::get_metrics;
use commands::schema::{
  describe_collection, get_collection_stats, list_collections, list_databases,
  list_databases_for_uri,
};
use commands::system::{cancel_query_cmd, get_metrics, get_system_status};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_mcp_bridge::init())
    .invoke_handler(tauri::generate_handler![
      save_connection,
      list_connections,
      delete_connection,
      update_connection,
      test_connection,
      test_connection_status,
      get_connection,
      list_collections,
      list_databases,
      list_databases_for_uri,
      describe_collection,
      get_collection_stats,
      query_data,
      execute_raw,
      get_server_version,
      get_system_status,
      get_metrics,
      cancel_query_cmd,
    ])
    .run(tauri::generate_context!())
    .unwrap_or_else(|e| {
      tracing::error!("Failed to run tauri application: {}", e);
      std::process::exit(1);
    });
}
