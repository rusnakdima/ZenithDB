use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, rename = "ConnectionEntity")]
pub struct ConnectionEntity {
  pub id: String,
  #[serde(rename = "type")]
  pub type_: String,
  pub name: String,
  pub config: crate::commands::connection::ConnectionConfig,
  pub created_at: i64,
  pub updated_at: i64,
}

impl ConnectionEntity {
  pub fn new(
    id: String,
    type_: String,
    name: String,
    config: crate::commands::connection::ConnectionConfig,
  ) -> Self {
    let now = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .unwrap()
      .as_millis() as i64;
    Self {
      id,
      type_,
      name,
      config,
      created_at: now,
      updated_at: now,
    }
  }
}
