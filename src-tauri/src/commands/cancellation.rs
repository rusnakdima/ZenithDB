use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::CancellationToken;
use tokio::sync::RwLock;
use tracing::debug;

const ENTRY_TTL_SECS: u64 = 300;

struct Entry {
  token: CancellationToken,
  registered_at: Instant,
}

pub struct CancellationRegistry {
  tokens: RwLock<HashMap<String, Entry>>,
  cleanup_task: RwLock<Option<tokio::task::JoinHandle<()>>>,
  shutdown: AtomicBool,
}

impl CancellationRegistry {
  pub fn new() -> Self {
    Self {
      tokens: RwLock::new(HashMap::new()),
      cleanup_task: RwLock::new(None),
      shutdown: AtomicBool::new(false),
    }
  }

  pub async fn register(&self, query_id: &str) -> CancellationToken {
    let token = CancellationToken::new();
    let mut tokens = self.tokens.write().await;
    tokens.insert(
      query_id.to_string(),
      Entry {
        token: token.clone(),
        registered_at: Instant::now(),
      },
    );
    token
  }

  pub async fn cancel(&self, query_id: &str) -> bool {
    let tokens = self.tokens.read().await;
    if let Some(entry) = tokens.get(query_id) {
      entry.token.cancel();
      true
    } else {
      false
    }
  }

  pub async fn unregister(&self, query_id: &str) {
    let mut tokens = self.tokens.write().await;
    if let Some(entry) = tokens.remove(query_id) {
      entry.token.cancel();
    }
  }

  pub async fn cancel_all(&self) {
    let mut tokens = self.tokens.write().await;
    for (_, entry) in tokens.drain() {
      entry.token.cancel();
    }
  }

  pub async fn cleanup_stale(&self) {
    let now = Instant::now();
    let ttl = Duration::from_secs(ENTRY_TTL_SECS);
    let mut tokens = self.tokens.write().await;
    let before_count = tokens.len();
    tokens.retain(|query_id, entry| {
      if now.duration_since(entry.registered_at) > ttl {
        debug!(query_id = %query_id, "[CANCELLATION] Removing stale cancellation");
        entry.token.cancel();
        false
      } else {
        true
      }
    });
    let removed_count = before_count - tokens.len();
    if removed_count > 0 {
      debug!(removed = %removed_count, remaining = %tokens.len(), "[CANCELLATION] Cleanup completed");
    }
  }

  pub async fn start_background_cleanup(self: &Arc<Self>) {
    debug!("[CANCELLATION] Starting background cleanup task");
    let registry = self.clone();
    let handle = tokio::spawn(async move {
      let mut interval = tokio::time::interval(Duration::from_secs(60));
      while !registry.shutdown.load(Ordering::Relaxed) {
        tokio::select! {
            _ = interval.tick() => {
                debug!("[CANCELLATION] Running periodic cleanup");
                registry.cleanup_stale().await;
            }
        }
      }
      debug!("[CANCELLATION] Background cleanup task shutting down");
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

impl Default for CancellationRegistry {
  fn default() -> Self {
    Self::new()
  }
}

use once_cell::sync::Lazy;
use std::sync::Arc;
use tokio::sync::Mutex;

static CANCELLATION_REGISTRY: Lazy<Mutex<Arc<CancellationRegistry>>> = Lazy::new(|| {
  let registry = Arc::new(CancellationRegistry::new());
  Mutex::new(registry)
});

pub async fn register_query() -> (String, CancellationToken) {
  let query_id = uuid::Uuid::new_v4().to_string();
  let registry = CANCELLATION_REGISTRY.lock().await;
  let token = registry.register(&query_id).await;
  (query_id, token)
}

pub async fn cancel_query(query_id: &str) -> bool {
  let registry = CANCELLATION_REGISTRY.lock().await;
  registry.cancel(query_id).await
}

pub async fn unregister_query(query_id: &str) {
  let registry = CANCELLATION_REGISTRY.lock().await;
  registry.unregister(query_id).await;
}

pub async fn with_cancellation<F, T>(
  query_id: &str,
  token: CancellationToken,
  f: F,
) -> Result<T, String>
where
  F: std::future::Future<Output = Result<T, String>>,
{
  tokio::select! {
      result = f => result,
      _ = token.cancelled() => Err("Query cancelled".to_string()),
  }
}
