use crate::commands::error_utils::ToStringError;
use log::debug;
use std::path::PathBuf;

pub struct NosqlOrmAdapter;

pub(crate) fn validate_safe_path(base: &str, user_input: &str) -> Result<PathBuf, String> {
  debug!(
    "base_path = {}, user_input = {} [ADAPTER] Validating path",
    base, user_input
  );
  let base_path = PathBuf::from(base);
  let base_canonical = base_path.canonicalize().map_err_string()?;
  let joined = base_path.join(user_input);
  let joined_canonical = joined.canonicalize().map_err_string()?;
  if joined_canonical.starts_with(&base_canonical) {
    debug!(
      "validated_path = {} [ADAPTER] Path validation successful",
      joined_canonical.display()
    );
    Ok(joined)
  } else {
    debug!("[ADAPTER] Path traversal detected");
    Err("Path traversal detected".to_string())
  }
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
