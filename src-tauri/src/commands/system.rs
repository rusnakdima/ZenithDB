use serde::{Deserialize, Serialize};
use sysinfo::{Disks, Networks, System};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
  pub cpu_usage: f32,
  pub ram_used: u64,
  pub ram_total: u64,
  pub disk_used: u64,
  pub disk_total: u64,
  pub network_received: u64,
  pub network_transmitted: u64,
  pub uptime: u64,
  pub status: String,
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

#[tauri::command]
pub fn get_system_status() -> Result<SystemMetrics, String> {
  let mut sys = System::new_all();
  sys.refresh_cpu_all();
  sys.refresh_memory();

  let cpu_usage = sys.global_cpu_usage();
  let ram_used = sys.used_memory();
  let ram_total = sys.total_memory();

  let disks = Disks::new_with_refreshed_list();
  let (disk_used, disk_total) = disks.iter().fold((0u64, 0u64), |(used, total), disk| {
    (
      used + disk.total_space() - disk.available_space(),
      total + disk.total_space(),
    )
  });

  let networks = Networks::new_with_refreshed_list();
  let (network_received, network_transmitted) =
    networks
      .iter()
      .fold((0u64, 0u64), |(recv, trans), (_, data)| {
        (
          recv + data.total_received(),
          trans + data.total_transmitted(),
        )
      });

  let uptime = System::uptime();
  let status = calculate_status(cpu_usage, ram_used, ram_total);

  Ok(SystemMetrics {
    cpu_usage,
    ram_used,
    ram_total,
    disk_used,
    disk_total,
    network_received,
    network_transmitted,
    uptime,
    status,
  })
}
