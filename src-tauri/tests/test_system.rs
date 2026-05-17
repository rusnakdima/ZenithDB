use crate::commands::system::calculate_status;

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

#[test]
fn test_calculate_status_ram_warning() {
  let status = calculate_status(30.0, 12_000_000_000_u64, 16_000_000_000_u64);
  assert_eq!(status, "warning");
}

#[test]
fn test_calculate_status_equal_usage() {
  let status = calculate_status(70.0, 11_200_000_000_u64, 16_000_000_000_u64);
  assert_eq!(status, "warning");
}
