fn validate_conn_id(id: &str) -> Result<(), String> {
  if id.len() != 36 {
    return Err("Connection ID must be 36 characters".to_string());
  }
  let parts: Vec<&str> = id.split('-').collect();
  if parts.len() != 5 {
    return Err("Invalid UUID format".to_string());
  }
  if parts[0].len() != 8
    || parts[1].len() != 4
    || parts[2].len() != 4
    || parts[3].len() != 4
    || parts[4].len() != 12
  {
    return Err("Invalid UUID segment lengths".to_string());
  }
  if !parts
    .iter()
    .all(|p| p.chars().all(|c| c.is_ascii_hexdigit()))
  {
    return Err("Connection ID contains invalid characters".to_string());
  }
  Ok(())
}

fn validate_name(name: &str) -> Result<(), String> {
  if name.is_empty() {
    return Err("Name cannot be empty".to_string());
  }
  if name.len() > 255 {
    return Err("Name must be 255 characters or less".to_string());
  }
  if name.contains(['/', '\\', '\0', ';', '\'', '"', '`', '(', ')', ',']) {
    return Err("Name contains invalid characters".to_string());
  }
  let lower = name.to_lowercase();
  if lower.contains("drop ")
    || lower.contains("delete ")
    || lower.contains("insert ")
    || lower.contains("update ")
    || lower.contains("select ")
    || lower.contains("--")
    || lower.contains("/*")
  {
    return Err("Name contains invalid patterns".to_string());
  }
  Ok(())
}

fn validate_sql(sql: &str) -> Result<(), String> {
  let trimmed = sql.trim();
  if trimmed.is_empty() {
    return Err("Empty SQL statement".to_string());
  }
  let upper = trimmed.to_uppercase();
  let allowed = [
    "SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER", "SHOW", "USE", "DESCRIBE",
    "EXPLAIN",
  ];
  if !allowed.iter().any(|cmd| upper.starts_with(cmd)) {
    return Err("Only SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, SHOW, USE, DESCRIBE, EXPLAIN are allowed".to_string());
  }
  if trimmed.contains(';') {
    return Err("Multiple statements not allowed".to_string());
  }
  if trimmed.contains("--") || trimmed.contains("/*") || trimmed.contains("*/") {
    return Err("SQL comments not allowed".to_string());
  }
  Ok(())
}

fn calculate_status(cpu_usage: f32, ram_used: u64, ram_total: u64) -> String {
  let ram_usage = if ram_total > 0 {
    (ram_used as f32 / ram_total as f32) * 100.0
  } else {
    0.0
  };

  let cpu_usage = if cpu_usage.is_nan() { 0.0 } else { cpu_usage };
  let ram_usage = if ram_usage.is_nan() { 0.0 } else { ram_usage };

  let max_usage = cpu_usage.max(ram_usage);

  if max_usage >= 90.0 {
    "critical".to_string()
  } else if max_usage >= 70.0 {
    "warning".to_string()
  } else {
    "optimal".to_string()
  }
}

#[test]
fn test_validate_conn_id_valid() {
  let id = "12345678-1234-1234-1234-123456789012";
  assert!(validate_conn_id(id).is_ok());
}

#[test]
fn test_validate_conn_id_invalid_length() {
  let id = "12345678-1234-1234-1234-12345678901";
  assert!(validate_conn_id(id).is_err());
}

#[test]
fn test_validate_conn_id_invalid_segments() {
  let id = "12345678-1234-1234-1234-12345678901";
  let result = validate_conn_id(id);
  assert!(result.is_err());
}

#[test]
fn test_validate_conn_id_invalid_chars() {
  let id = "12345678-1234-1234-1234-12345678901!";
  let result = validate_conn_id(id);
  assert!(result.is_err());
}

#[test]
fn test_validate_name_valid() {
  let name = "valid_collection_name";
  assert!(validate_name(name).is_ok());
}

#[test]
fn test_validate_name_empty() {
  let name = "";
  assert!(validate_name(name).is_err());
}

#[test]
fn test_validate_name_too_long() {
  let name = "a".repeat(256);
  assert!(validate_name(&name).is_err());
}

#[test]
fn test_validate_name_invalid_chars() {
  let name = "collection/name";
  assert!(validate_name(name).is_err());
}

#[test]
fn test_validate_name_invalid_patterns() {
  let name = "drop users"; // contains "drop " pattern
  assert!(validate_name(name).is_err());
}

#[test]
fn test_validate_name_sql_injection() {
  let name = "collection--select";
  assert!(validate_name(name).is_err());
}

#[test]
fn test_validate_sql_valid_select() {
  let sql = "SELECT * FROM users";
  assert!(validate_sql(sql).is_ok());
}

#[test]
fn test_validate_sql_valid_insert() {
  let sql = "INSERT INTO users VALUES (1, 'test')";
  assert!(validate_sql(sql).is_ok());
}

#[test]
fn test_validate_sql_valid_update() {
  let sql = "UPDATE users SET name = 'test'";
  assert!(validate_sql(sql).is_ok());
}

#[test]
fn test_validate_sql_valid_delete() {
  let sql = "DELETE FROM users WHERE id = 1";
  assert!(validate_sql(sql).is_ok());
}

#[test]
fn test_validate_sql_valid_create() {
  let sql = "CREATE TABLE test (id INT)";
  assert!(validate_sql(sql).is_ok());
}

#[test]
fn test_validate_sql_valid_drop() {
  let sql = "DROP TABLE users";
  assert!(validate_sql(sql).is_ok());
}

#[test]
fn test_validate_sql_empty() {
  let sql = "";
  assert!(validate_sql(sql).is_err());
}

#[test]
fn test_validate_sql_multiple_statements() {
  let sql = "SELECT * FROM users; SELECT * FROM orders";
  assert!(validate_sql(sql).is_err());
}

#[test]
fn test_validate_sql_sql_comments() {
  let sql = "SELECT * FROM users -- comment";
  assert!(validate_sql(sql).is_err());
}

#[test]
fn test_validate_sql_unsupported_command() {
  let sql = "TRUNCATE TABLE users";
  assert!(validate_sql(sql).is_err());
}

#[test]
fn test_calculate_status_optimal() {
  let status = calculate_status(20.0, 4_000_000_000_u64, 16_000_000_000_u64);
  assert_eq!(status, "optimal");
}

#[test]
fn test_calculate_status_warning() {
  let status = calculate_status(75.0, 8_000_000_000_u64, 16_000_000_000_u64);
  assert_eq!(status, "warning");
}

#[test]
fn test_calculate_status_critical() {
  let status = calculate_status(95.0, 15_000_000_000_u64, 16_000_000_000_u64);
  assert_eq!(status, "critical");
}

#[test]
fn test_calculate_status_nan_cpu() {
  let status = calculate_status(f32::NAN, 4_000_000_000_u64, 16_000_000_000_u64);
  assert_eq!(status, "optimal");
}

#[test]
fn test_calculate_status_zero_ram() {
  let status = calculate_status(50.0, 0_u64, 16_000_000_000_u64);
  assert_eq!(status, "optimal");
}
