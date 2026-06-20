// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
  if let Err(e) = zenithdb_lib::run() {
    eprintln!("Error running application: {}", e);
    std::process::exit(1);
  }
}
