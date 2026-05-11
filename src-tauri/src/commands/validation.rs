pub const MAX_QUERY_SIZE: usize = 10 * 1024 * 1024;

pub fn validate_query_size(query: &str) -> Result<(), String> {
  if query.len() > MAX_QUERY_SIZE {
    return Err(format!(
      "Query size exceeds maximum allowed size of {} bytes",
      MAX_QUERY_SIZE
    ));
  }
  Ok(())
}
