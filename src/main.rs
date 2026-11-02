// forge-thin-shell: the app is JSON; the library boots it.
fn main() {
  // Opt-in native shell: run with `cargo run -p zenithdb --features
  // native-shell`. Without the feature this remains the WebView path,
  // unchanged (same pattern as the demo app).
  #[cfg(feature = "native-shell")]
  forge::shell::install(std::sync::Arc::new(forge::shell_gpui::GpuShell::new()));

  forge::start("com.tcs.zenithdb").expect("forge app failed");
}
