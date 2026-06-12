use prometheus::{
  Counter, CounterVec, Gauge, Histogram, HistogramOpts, HistogramVec, IntCounter, IntGauge, Opts,
  Registry,
};
use std::time::Instant;
use crate::logger::DataflowTimer;

pub struct Metrics {
  pub registry: Registry,
  pub query_count: IntCounter,
  pub query_duration_seconds: Histogram,
  pub connection_count: IntGauge,
  pub active_queries: IntGauge,
}

impl Metrics {
  pub fn new() -> Result<Self, String> {
    let registry = Registry::new();

    let query_count = IntCounter::new("zenithdb_query_count", "Total number of queries")
      .map_err(|e| format!("failed to create query_count counter: {}", e))?;

    let query_duration_seconds = Histogram::with_opts(
      HistogramOpts::new(
        "zenithdb_query_duration_seconds",
        "Query duration in seconds",
      )
      .buckets(vec![
        0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
      ]),
    )
    .map_err(|e| format!("failed to create query_duration_seconds histogram: {}", e))?;

    let connection_count = IntGauge::new("zenithdb_connection_count", "Number of connections")
      .map_err(|e| format!("failed to create connection_count gauge: {}", e))?;

    let active_queries = IntGauge::new("zenithdb_active_queries", "Number of active queries")
      .map_err(|e| format!("failed to create active_queries gauge: {}", e))?;

    registry
      .register(Box::new(query_count.clone()))
      .map_err(|e| format!("failed to register query_count: {}", e))?;
    registry
      .register(Box::new(query_duration_seconds.clone()))
      .map_err(|e| format!("failed to register query_duration_seconds: {}", e))?;
    registry
      .register(Box::new(connection_count.clone()))
      .map_err(|e| format!("failed to register connection_count: {}", e))?;
    registry
      .register(Box::new(active_queries.clone()))
      .map_err(|e| format!("failed to register active_queries: {}", e))?;

    Ok(Self {
      registry,
      query_count,
      query_duration_seconds,
      connection_count,
      active_queries,
    })
  }

  pub fn new_with_fallback() -> Self {
    Self::new().unwrap_or_else(|e| {
      tracing::warn!("Failed to create metrics: {}", e);
      Self::new_fallback_metrics()
    })
  }

  fn new_fallback_metrics() -> Self {
    let registry = Registry::new();

    let query_count = IntCounter::new("zenithdb_query_count_fallback", "Fallback counter")
      .expect("failed to create fallback query_count counter");
    let query_duration_seconds = Histogram::with_opts(
      HistogramOpts::new("zenithdb_query_duration_fallback", "Fallback histogram").buckets(vec![
        0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
      ]),
    )
    .expect("failed to create fallback query_duration_seconds histogram");
    let connection_count = IntGauge::new("zenithdb_connection_count_fallback", "Fallback gauge")
      .expect("failed to create fallback connection_count gauge");
    let active_queries = IntGauge::new("zenithdb_active_queries_fallback", "Fallback gauge")
      .expect("failed to create fallback active_queries gauge");

    let _ = registry.register(Box::new(query_count.clone()));
    let _ = registry.register(Box::new(query_duration_seconds.clone()));
    let _ = registry.register(Box::new(connection_count.clone()));
    let _ = registry.register(Box::new(active_queries.clone()));

    Self {
      registry,
      query_count,
      query_duration_seconds,
      connection_count,
      active_queries,
    }
  }

  pub fn record_query_start(&self) -> QueryGuard {
    self.active_queries.inc();
    QueryGuard {
      metrics: self,
      start: Instant::now(),
    }
  }

  pub fn set_connection_count(&self, count: i64) {
    self.connection_count.set(count);
  }
}

impl Default for Metrics {
  fn default() -> Self {
    Self::new_with_fallback()
  }
}

pub struct QueryGuard<'a> {
  metrics: &'a Metrics,
  start: Instant,
}

impl<'a> Drop for QueryGuard<'a> {
  fn drop(&mut self) {
    self.metrics.active_queries.dec();
    self.metrics.query_count.inc();
    let duration = self.start.elapsed().as_secs_f64();
    self.metrics.query_duration_seconds.observe(duration);
  }
}

use once_cell::sync::Lazy;
use tokio::sync::Mutex;

pub static METRICS: Lazy<Mutex<Metrics>> = Lazy::new(|| Mutex::new(Metrics::new_with_fallback()));

pub async fn record_query<F, T>(f: F) -> Result<T, String>
where
  F: std::future::Future<Output = Result<T, String>>,
{
  let timer = DataflowTimer::new("record_query");
  let guard = {
    let metrics = METRICS.lock().await;
    metrics.record_query_start()
  };
  let result = f.await;
  drop(guard);
  match &result {
    Ok(_) => {
      tracing::debug!(command = "record_query", status = "success", "[METRICS]");
    }
    Err(e) => {
      timer.finish_error(e);
      return result;
    }
  }
  result
}
