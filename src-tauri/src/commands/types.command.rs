use serde::{Deserialize, Serialize};
use serde_json::Value;
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawResult {
  pub columns: Vec<String>,
  pub rows: Vec<Vec<Value>>,
  pub affected_rows: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionMeta {
  pub name: String,
  pub count: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
  pub name: String,
  pub data_type: String,
  pub nullable: bool,
  pub is_primary_key: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexInfo {
  pub name: String,
  pub columns: Vec<String>,
  pub is_unique: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionSchema {
  pub name: String,
  pub columns: Vec<ColumnInfo>,
  pub indexes: Vec<IndexInfo>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionStats {
  pub name: String,
  pub document_count: u64,
  pub size_bytes: u64,
  pub index_count: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseMeta {
  pub name: String,
  pub size_bytes: Option<u64>,
  pub table_count: Option<u64>,
}
impl DatabaseMeta {
  pub fn from_name(name: &str) -> Self {
    Self {
      name: name.to_string(),
      size_bytes: None,
      table_count: None,
    }
  }
}
