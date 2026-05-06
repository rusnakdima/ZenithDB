pub trait ToStringError<T> {
  fn map_err_string(self) -> Result<T, String>;
}

impl<T, E: std::fmt::Display> ToStringError<T> for Result<T, E> {
  fn map_err_string(self) -> Result<T, String> {
    self.map_err(|e| e.to_string())
  }
}
