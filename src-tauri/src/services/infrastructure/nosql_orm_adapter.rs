use crate::commands::error_utils::ToStringError;
use std::path::PathBuf;
pub struct NosqlOrmAdapter;
pub(crate) fn validate_safe_path(base: &str, user_input: &str) -> Result<PathBuf, String> {
  let base_path = PathBuf::from(base);
  let base_canonical = base_path.canonicalize().map_err_string()?;
  let joined = base_path.join(user_input);
  if joined.exists() {
    let joined_canonical = joined.canonicalize().map_err_string()?;
    if !joined_canonical.starts_with(&base_canonical) {
      log::debug!("[ADAPTER] Path traversal detected");
      return Err("Path traversal detected".to_string());
    }
  }
  log::debug!(
    "validated_path = {} [ADAPTER] Path validation successful",
    joined.display()
  );
  Ok(joined)
}
impl NosqlOrmAdapter {
  pub async fn create_database_json(base_path: &str, name: &str) -> Result<(), String> {
    let db_path = validate_safe_path(base_path, name)?;
    tokio::fs::create_dir_all(&db_path).await.map_err_string()?;
    Ok(())
  }
  pub async fn drop_database_json(base_path: &str, name: &str) -> Result<(), String> {
    let db_path = validate_safe_path(base_path, name)?;
    if db_path.exists() && db_path.is_dir() {
      tokio::fs::remove_dir_all(&db_path).await.map_err_string()?;
    }
    Ok(())
  }
}
