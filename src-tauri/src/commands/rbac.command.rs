use std::sync::Arc;
use tokio::sync::RwLock;

static RBAC_JSON_PROVIDER: tokio::sync::OnceCell<
  Arc<RwLock<Option<nosql_orm::providers::JsonProvider>>>,
> = tokio::sync::OnceCell::const_new();

pub async fn get_rbac_provider(
) -> Result<Arc<RwLock<Option<nosql_orm::providers::JsonProvider>>>, String> {
  let prov = RBAC_JSON_PROVIDER
    .get_or_try_init(|| async {
      let home = match dirs::home_dir() {
        Some(h) => h,
        None => return Err(String::from("No home dir")),
      };
      let path = home.join(".zenithdb").join("rbac_data");
      if let Err(e) = std::fs::create_dir_all(&path) {
        return Err(e.to_string());
      }
      let provider = match nosql_orm::providers::JsonProvider::new(path.to_str().unwrap()).await {
        Ok(p) => p,
        Err(e) => return Err(e.to_string()),
      };
      Ok(Arc::new(RwLock::new(Some(provider))))
    })
    .await
    .map_err(|e| e)?
    .clone();
  Ok(prov)
}

use crate::models::response as resp;
use crate::models::response::ResponseModel;
use serde_json::Value;
use tauri_shared::rbac::auth;
use tauri_shared::rbac::commands as rbac_logic;

#[tauri::command]
pub async fn rbac_list_roles() -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  rbac_logic::rbac_list_roles(db)
    .await
    .map(|roles| {
      resp::success(
        "Roles listed",
        serde_json::to_value(roles).unwrap_or(serde_json::Value::Null),
      )
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rbac_create_role(name: String, description: String) -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  rbac_logic::rbac_create_role(db, name, description)
    .await
    .map(|role| {
      resp::success(
        "Role created",
        serde_json::to_value(role).unwrap_or(serde_json::Value::Null),
      )
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rbac_delete_role(role_id: String) -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  rbac_logic::rbac_delete_role(db, role_id)
    .await
    .map(|_| resp::success("Role deleted", serde_json::Value::Null))
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rbac_list_permissions() -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  rbac_logic::rbac_list_permissions(db)
    .await
    .map(|perms| {
      resp::success(
        "Permissions listed",
        serde_json::to_value(perms).unwrap_or(serde_json::Value::Null),
      )
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rbac_create_permission(
  name: String,
  resource: String,
  action: String,
) -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  rbac_logic::rbac_create_permission(db, name, resource, action)
    .await
    .map(|perm| {
      resp::success(
        "Permission created",
        serde_json::to_value(perm).unwrap_or(serde_json::Value::Null),
      )
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rbac_delete_permission(perm_id: String) -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  rbac_logic::rbac_delete_permission(db, perm_id)
    .await
    .map(|_| resp::success("Permission deleted", serde_json::Value::Null))
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rbac_assign_role_to_user(
  user_id: String,
  role_id: String,
) -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  rbac_logic::rbac_assign_role_to_user(db, user_id, role_id)
    .await
    .map(|ur| {
      resp::success(
        "Role assigned to user",
        serde_json::to_value(ur).unwrap_or(serde_json::Value::Null),
      )
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rbac_remove_role_from_user(
  user_id: String,
  role_id: String,
) -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  rbac_logic::rbac_remove_role_from_user(db, user_id, role_id)
    .await
    .map(|_| resp::success("Role removed from user", serde_json::Value::Null))
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rbac_grant_permission(
  role_id: String,
  perm_id: String,
) -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  rbac_logic::rbac_grant_permission(db, role_id, perm_id)
    .await
    .map(|rp| {
      resp::success(
        "Permission granted",
        serde_json::to_value(rp).unwrap_or(serde_json::Value::Null),
      )
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rbac_revoke_permission(
  role_id: String,
  perm_id: String,
) -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  rbac_logic::rbac_revoke_permission(db, role_id, perm_id)
    .await
    .map(|_| resp::success("Permission revoked", serde_json::Value::Null))
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rbac_get_user_roles(user_id: String) -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  rbac_logic::rbac_get_user_roles(db, user_id)
    .await
    .map(|roles| {
      resp::success(
        "User roles retrieved",
        serde_json::to_value(roles).unwrap_or(serde_json::Value::Null),
      )
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rbac_get_role_permissions(role_id: String) -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  rbac_logic::rbac_get_role_permissions(db, role_id)
    .await
    .map(|perms| {
      resp::success(
        "Role permissions retrieved",
        serde_json::to_value(perms).unwrap_or(serde_json::Value::Null),
      )
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn login(username: String, password: String) -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  auth::login(db, username, password)
    .await
    .map(|session| {
      resp::success(
        "Logged in",
        serde_json::to_value(session).unwrap_or(serde_json::Value::Null),
      )
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn logout(session_token: String) -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  auth::logout(db, session_token)
    .await
    .map(|_| resp::success("Logged out", serde_json::Value::Null))
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn register(
  username: String,
  password: String,
  email: String,
) -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  auth::register(db, username, password, email)
    .await
    .map(|user| {
      resp::success(
        "User registered",
        serde_json::to_value(user).unwrap_or(serde_json::Value::Null),
      )
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_current_user(session_token: String) -> Result<ResponseModel, String> {
  let prov = get_rbac_provider().await?;
  let guard = prov.read().await;
  let db = guard.as_ref().ok_or("Not initialized")?;
  auth::get_current_user(db, session_token)
    .await
    .map(|user| {
      resp::success(
        "Current user retrieved",
        serde_json::to_value(user).unwrap_or(serde_json::Value::Null),
      )
    })
    .map_err(|e| e.to_string())
}
