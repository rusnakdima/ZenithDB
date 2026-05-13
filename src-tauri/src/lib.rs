mod commands;
mod infrastructure;
mod logger;

use commands::admin::{
  create_collection, drop_collection, execute_raw, get_server_version, rename_collection,
};
use commands::connection::{
  check_health, delete_connection, get_connection, list_connections, save_connection,
  test_connection, test_connection_status, update_connection,
};
use commands::data::{delete_row, query_data, save_row};
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
use commands::entities::query::routes as query_routes;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  logger::init_logger();

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
      query_routes::query_execute,
      query_routes::query_save,
      query_routes::query_delete,
      query_routes::query_raw,
      query_routes::query_server_version,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
