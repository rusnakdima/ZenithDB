use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::debug;

const MAX_REQUESTS: usize = 100;
const WINDOW_SECS: u64 = 60;
const ENTRY_TTL_SECS: u64 = 300;
const CLEANUP_INTERVAL_SECS: u64 = 300;

struct Entry {
  timestamps: Vec<Instant>,
  last_access: Instant,
}

impl Entry {
  fn new() -> Self {
    Self {
      timestamps: Vec::new(),
      last_access: Instant::now(),
    }
  }

  fn update_access(&mut self) {
    self.last_access = Instant::now();
  }

  fn is_stale(&self) -> bool {
    Instant::now().duration_since(self.last_access) > Duration::from_secs(ENTRY_TTL_SECS)
  }
}

pub struct RateLimiter {
  requests: RwLock<HashMap<String, Entry>>,
  cleanup_task: RwLock<Option<tokio::task::JoinHandle<()>>>,
  shutdown: AtomicBool,
}

impl RateLimiter {
  pub fn new() -> Self {
    Self {
      requests: RwLock::new(HashMap::new()),
      cleanup_task: RwLock::new(None),
      shutdown: AtomicBool::new(false),
    }
  }

  pub async fn check_rate_limit(&self, conn_id: &str) -> Result<(), String> {
    let mut requests = self.requests.write().await;
    let now = Instant::now();
    let window = Duration::from_secs(WINDOW_SECS);

    requests.retain(|_, entry| !entry.is_stale());

    let entry = requests
      .entry(conn_id.to_string())
      .or_insert_with(Entry::new);
    entry.update_access();
    entry.timestamps.retain(|t| now.duration_since(*t) < window);

    if entry.timestamps.len() >= MAX_REQUESTS {
      debug!(conn_id = %conn_id, request_count = %entry.timestamps.len(), "[RATE_LIMIT] Rate limit exceeded");
      return Err("Rate limit exceeded".to_string());
    }

    entry.timestamps.push(now);
    debug!(conn_id = %conn_id, request_count = %entry.timestamps.len(), "[RATE_LIMIT] Request allowed");
    Ok(())
  }

  pub async fn cleanup_stale(&self) {
    let mut requests = self.requests.write().await;
    let before_count = requests.len();
    requests.retain(|conn_id, entry| {
      if entry.is_stale() {
        debug!(conn_id = %conn_id, "[RATE_LIMIT] Cleaning stale entry");
        false
      } else {
        true
      }
    });
    let removed_count = before_count - requests.len();
    if removed_count > 0 {
      debug!(removed = %removed_count, remaining = %requests.len(), "[RATE_LIMIT] Cleanup completed");
    }
  }

  pub async fn start_background_cleanup(self: &Arc<Self>) {
    debug!("[RATE_LIMIT] Starting background cleanup task");
    let limiter = self.clone();
    let handle = tokio::spawn(async move {
      let mut interval = tokio::time::interval(Duration::from_secs(CLEANUP_INTERVAL_SECS));
      while !limiter.shutdown.load(Ordering::Relaxed) {
        tokio::select! {
            _ = interval.tick() => {
                debug!("[RATE_LIMIT] Running periodic cleanup");
                limiter.cleanup_stale().await;
            }
        }
      }
      debug!("[RATE_LIMIT] Background cleanup task shutting down");
    });
    let mut task = self.cleanup_task.write().await;
    *task = Some(handle);
  }

  pub async fn shutdown(&self) {
    self.shutdown.store(true, Ordering::Relaxed);
    let mut task = self.cleanup_task.write().await;
    if let Some(handle) = task.take() {
      handle.abort();
    }
  }
}

impl Default for RateLimiter {
  fn default() -> Self {
    Self::new()
  }
}

use once_cell::sync::Lazy;
use std::sync::Arc;
use tokio::sync::Mutex;

pub static RATE_LIMITER: Lazy<Mutex<Arc<RateLimiter>>> = Lazy::new(|| {
  let limiter = Arc::new(RateLimiter::new());
  Mutex::new(limiter)
});

pub async fn check_rate_limit(conn_id: &str) -> Result<(), String> {
  let limiter = RATE_LIMITER.lock().await;
  limiter.check_rate_limit(conn_id).await
}
