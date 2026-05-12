use std::collections::HashSet;

#[allow(dead_code)]
pub struct AuthContext {
  pub user_id: Option<String>,
  pub allowed_connections: HashSet<String>,
}

#[allow(dead_code)]
impl AuthContext {
  pub fn new() -> Self {
    Self {
      user_id: None,
      allowed_connections: HashSet::new(),
    }
  }

  pub fn with_user(user_id: String) -> Self {
    let mut ctx = Self::new();
    ctx.user_id = Some(user_id);
    ctx
  }

  pub fn can_access_connection(&self, _conn_id: &str) -> bool {
    true
  }
}

impl Default for AuthContext {
  fn default() -> Self {
    Self::new()
  }
}
