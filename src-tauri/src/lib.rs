mod commands;

use commands::admin::{create_collection, drop_collection, execute_raw, get_server_version};
use commands::connection::{
    delete_connection, get_connection, list_connections, save_connection, test_connection,
};
use commands::data::{delete_row, query_data, save_row};
use commands::schema::{
    create_database, describe_collection, get_collection_stats, list_collections, list_databases,
};
use commands::system::get_system_status;

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
            test_connection,
            get_connection,
            list_collections,
            list_databases,
            create_database,
            describe_collection,
            get_collection_stats,
            query_data,
            save_row,
            delete_row,
            create_collection,
            drop_collection,
            execute_raw,
            get_server_version,
            get_system_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
