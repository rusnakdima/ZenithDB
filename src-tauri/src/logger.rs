use std::path::PathBuf;
use tracing::Level;
use tracing_subscriber::{
  fmt::{self, format::FmtSpan},
  layer::SubscriberExt,
  util::SubscriberInitExt,
  EnvFilter,
};

fn get_log_dir() -> Result<PathBuf, String> {
  let log_dir = dirs::home_dir()
    .ok_or("Failed to get home directory")?
    .join(".zenithdb")
    .join("logs");
  std::fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
  Ok(log_dir)
}

pub fn init_logger() {
  let log_enabled = std::env::var("ZENITH_LOG")
    .map(|v| v.to_lowercase() != "false")
    .unwrap_or(true);

  if !log_enabled {
    tracing_subscriber::registry()
      .with(EnvFilter::new("off"))
      .init();
    return;
  }

  let log_level = std::env::var("ZENITH_LOG_LEVEL").unwrap_or_else(|_| "info".to_string());

  let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(&log_level));

  let file_appender = tracing_appender::rolling::daily(get_log_dir().unwrap(), "zenith.log");
  let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

  let file_layer = fmt::layer()
    .with_writer(non_blocking)
    .with_span_events(FmtSpan::CLOSE)
    .with_ansi(false)
    .with_target(true)
    .with_thread_ids(true);

  let console_layer = fmt::layer()
    .with_span_events(FmtSpan::CLOSE)
    .with_target(true);

  tracing_subscriber::registry()
    .with(env_filter)
    .with(file_layer)
    .with(console_layer)
    .init();

  tracing::info!("Logger initialized");
}

pub fn set_log_level(level: Level) {
  tracing::subscriber::set_global_default(
    tracing_subscriber::registry()
      .with(EnvFilter::new(level.to_string()))
      .with(
        fmt::layer()
          .with_span_events(FmtSpan::CLOSE)
          .with_target(true),
      ),
  )
  .unwrap();
}
