use crate::commands::connection_command::ConnectionConfig;
use chrono::{DateTime, Utc};
use nosql_orm::prelude::*;
use nosql_orm::soft_delete::SoftDeletable;
use nosql_orm::validators::Validate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionEntity {
  pub id: Option<String>,
  #[serde(rename = "type")]
  pub type_: String,
  pub name: String,
  pub config: ConnectionConfig,
  pub created_at: Option<DateTime<Utc>>,
  pub updated_at: Option<DateTime<Utc>>,
}

impl Entity for ConnectionEntity {
  fn meta() -> EntityMeta {
    EntityMeta::new("connections")
  }
  fn get_id(&self) -> Option<String> {
    self.id.clone()
  }
  fn set_id(&mut self, id: String) {
    self.id = Some(id);
  }
}

impl WithRelations for ConnectionEntity {
  fn relations() -> Vec<RelationDef> {
    vec![]
  }
}

impl Validate for ConnectionEntity {
  fn validate(&self) -> OrmResult<()> {
    Ok(())
  }
}

impl Timestamps for ConnectionEntity {
  fn created_at(&self) -> Option<DateTime<Utc>> {
    self.created_at
  }
  fn updated_at(&self) -> Option<DateTime<Utc>> {
    self.updated_at
  }
  fn set_created_at(&mut self, t: DateTime<Utc>) {
    self.created_at = Some(t);
  }
  fn set_updated_at(&mut self, t: DateTime<Utc>) {
    self.updated_at = Some(t);
  }
  fn apply_timestamps_for_insert(&mut self) {
    let now = Utc::now();
    if self.created_at.is_none() {
      self.created_at = Some(now);
    }
    if self.updated_at.is_none() {
      self.updated_at = Some(now);
    }
  }
  fn apply_timestamps_for_update(&mut self) {
    self.updated_at = Some(Utc::now());
  }
}

impl SoftDeletable for ConnectionEntity {
  fn deleted_at(&self) -> Option<DateTime<Utc>> {
    None
  }
  fn set_deleted_at(&mut self, _t: Option<DateTime<Utc>>) {}
}

impl ConnectionEntity {
  pub fn new(
    id: String,
    type_: String,
    name: String,
    config: ConnectionConfig,
  ) -> Self {
    Self {
      id: Some(id),
      type_,
      name,
      config,
      created_at: None,
      updated_at: None,
    }
  }
}
