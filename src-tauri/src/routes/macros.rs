#[macro_export]
macro_rules! impl_connection_command {
  ($name:ident, $service_method:ident) => {
    #[tauri::command]
    pub async fn $name(
      state: State<'_, AppState>,
      id: &str,
    ) -> Result<ResponseModel, ResponseModel> {
      let timer = DataflowTimer::new(stringify!($name));
      if let Err(e) = validate_conn_id(id) {
        let err = ResponseModel::error(&e);
        timer.finish_error(&e);
        return Err(err);
      }
      let params = serde_json::json!({ "id": id });
      log::debug!(
        "command = {}, params = {} [COMMAND_ENTRY]",
        stringify!($name),
        redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
      );
      let result = state.connection_service.$service_method(id).await;
      match &result {
        Ok(r) => timer.finish(r),
        Err(e) => timer.finish_error(&e.message),
      }
      result
    }
  };
}

#[macro_export]
macro_rules! impl_connection_command_with_config {
  ($name:ident, $service_method:ident, $config_type:ty) => {
    #[tauri::command]
    pub async fn $name(
      state: State<'_, AppState>,
      id: &str,
      config: $config_type,
    ) -> Result<ResponseModel, ResponseModel> {
      let timer = DataflowTimer::new(stringify!($name));
      if let Err(e) = validate_conn_id(id) {
        let err = ResponseModel::error(&e);
        timer.finish_error(&e);
        return Err(err);
      }
      let params = serde_json::json!({ "id": id, "config": &config });
      log::debug!(
        "command = {}, params = {} [COMMAND_ENTRY]",
        stringify!($name),
        redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
      );
      let result = state.connection_service.$service_method(id, config).await;
      match &result {
        Ok(r) => timer.finish(r),
        Err(e) => timer.finish_error(&e.message),
      }
      result
    }
  };
}

#[macro_export]
macro_rules! impl_connection_command_no_id {
  ($name:ident, $service_method:ident) => {
    #[tauri::command]
    pub async fn $name(
      state: State<'_, AppState>,
      config: ConnectionConfig,
    ) -> Result<ResponseModel, ResponseModel> {
      let timer = DataflowTimer::new(stringify!($name));
      let params = serde_json::json!({ "config": &config });
      log::debug!(
        "command = {}, params = {} [COMMAND_ENTRY]",
        stringify!($name),
        redact_sensitive_data(&serde_json::to_string(&params).unwrap_or_default())
      );
      let result = state.connection_service.$service_method(config).await;
      match &result {
        Ok(r) => timer.finish(r),
        Err(e) => timer.finish_error(&e.message),
      }
      result
    }
  };
}

#[macro_export]
macro_rules! impl_database_command {
  ($name:ident, $service_method:ident) => {
    #[tauri::command]
    pub async fn $name(
      state: State<'_, AppState>,
      connection_id: &str,
      name: &str,
    ) -> Result<ResponseModel, ResponseModel> {
      let timer = DataflowTimer::new(stringify!($name));
      let result = (|| async {
        validate_conn_id(connection_id).map_err(|e| ResponseModel::error(e))?;
        validate_name(name).map_err(|e| ResponseModel::error(e))?;
        let entry = get_connection_entry(connection_id)
          .await
          .map_err(|e| ResponseModel::error(e))?;
        match &entry.config.config {
          ConnectionConfigEnum::Sqlite { .. } => {
            Err(ResponseModel::error("SQLite does not support this operation"))
          }
          ConnectionConfigEnum::Json { path, .. } => {
            Err(ResponseModel::error("JSON provider does not support this operation"))
          }
          ConnectionConfigEnum::Redis { .. } => {
            Err(ResponseModel::error("Redis does not support this operation"))
          }
          ConnectionConfigEnum::Mongo { .. } => {
            Err(ResponseModel::error("MongoDB does not support this operation"))
          }
          ConnectionConfigEnum::Postgres { uri } => {
            let provider = crate::routes::provider::create_postgres_provider(uri)
              .await
              .map_err(|e| ResponseModel::error(e.to_string()))?;
            state.connection_service.$service_method(connection_id, name, &provider).await
          }
          ConnectionConfigEnum::MySql { uri } => {
            let provider = crate::routes::provider::create_mysql_provider(uri)
              .await
              .map_err(|e| ResponseModel::error(e.to_string()))?;
            state.connection_service.$service_method(connection_id, name, &provider).await
          }
        }
      })().await;
      match &result {
        Ok(resp) => timer.finish(resp),
        Err(err) => timer.finish_error(&err.message),
      }
      result
    }
  };
}
