use std::time::Duration;
use tokio::time::sleep;
use crate::commands::errors::ZenithError;
use tracing::warn;

fn is_transient_error(error: &str) -> bool {
    let lower = error.to_lowercase();
    lower.contains("connection reset")
        || lower.contains("connection refused")
        || lower.contains("timeout")
        || lower.contains("timed out")
        || lower.contains("temporary failure")
        || lower.contains("resource temporarily unavailable")
        || lower.contains("broken pipe")
        || lower.contains("connection aborted")
}

pub async fn with_retry<F, Fut, T>(
    mut operation: F,
    max_retries: u32,
) -> Result<T, ZenithError>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, ZenithError>>,
{
    let mut attempts = 0;

    loop {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                attempts += 1;
                if attempts > max_retries || !is_transient_error(&e.to_string()) {
                    warn!("Operation failed after {} attempts: {}", attempts, e);
                    return Err(e);
                }
                let backoff = Duration::from_millis(2u64.pow(attempts.min(10) as u32)).min(Duration::from_secs(30));
                sleep(backoff).await;
            }
        }
    }
}