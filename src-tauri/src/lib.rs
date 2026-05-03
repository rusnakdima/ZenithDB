mod commands;

use commands::admin::{create_collection, drop_collection, execute_raw, get_server_version};
use commands::connection::{delete_connection, list_connections, save_connection, test_connection};
use commands::data::{delete_row, query_data, save_row};
use commands::schema::{describe_collection, get_collection_stats, list_collections};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_connection,
            list_connections,
            delete_connection,
            test_connection,
            list_collections,
            describe_collection,
            get_collection_stats,
            query_data,
            save_row,
            delete_row,
            create_collection,
            drop_collection,
            execute_raw,
            get_server_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
