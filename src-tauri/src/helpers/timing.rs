use crate::models::response::ResponseModel;
use std::future::Future;

pub async fn timed_operation<F, T>(operation: F, context: &str) -> Result<T, ResponseModel>
where
  F: Future<Output = Result<T, ResponseModel>>,
{
  let start = std::time::Instant::now();
  let result = operation.await;
  let duration = start.elapsed();
  tracing::debug!(context = %context, elapsed_ms = %duration.as_millis(), "[TIMED_OPERATION]");
  result
}
