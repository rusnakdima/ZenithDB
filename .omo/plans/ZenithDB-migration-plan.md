# ZenithDB — Tauri → Dioxus Migration Plan

## Context

| Metric | Value |
|--------|-------|
| **Total AS-IS Commands** | 71 |
| **Active Commands (in both diagram and source)** | 71 |
| **Dead Commands (diagram only, not in source)** | 0 |
| **GAP Commands (source only, not in diagram)** | 0 |
| **Handler Types Planned** | 6 (invoke, navigate, set, toast, modal, guard) |
| **Phases** | 4 |
| **Target Architecture** | Dioxus + KAS Handlers + DDD Entity Modeling |

---

## Delta Analysis

### Commands Table (DEAD / GAP / ACTIVE)

All 71 commands from the AS-IS diagram are **ACTIVE** — every command in the diagram exists in `src-tauri/src/lib.rs`'s `invoke_handler`.

| Module | Command | Status |
|-------|---------|--------|
| **connection_command.rs** | `save_connection` | ACTIVE |
| | `list_connections` | ACTIVE |
| | `get_connection` | ACTIVE |
| | `delete_connection` | ACTIVE |
| | `update_connection` | ACTIVE |
| | `test_connection` | ACTIVE |
| | `test_connection_status` | ACTIVE |
| | `check_health` | ACTIVE |
| **database_command.rs** | `create_database` | ACTIVE |
| | `rename_database` | ACTIVE |
| | `delete_database` | ACTIVE |
| | `database_list` | ACTIVE |
| **schema_command.rs** | `collection_list` | ACTIVE |
| | `collection_stats` | ACTIVE |
| | `collection_create` | ACTIVE |
| | `collection_drop` | ACTIVE |
| | `collection_rename` | ACTIVE |
| | `describe_collection` | ACTIVE |
| | `get_ui_schema` | ACTIVE |
| **ipc_commands.rs** | `initialize_app` | ACTIVE |
| | `get_version` | ACTIVE |
| | `is_connected` | ACTIVE |
| | `insert_document` | ACTIVE |
| | `update_document` | ACTIVE |
| | `delete_document` | ACTIVE |
| | `soft_delete_document` | ACTIVE |
| | `create_index` | ACTIVE |
| | `drop_index` | ACTIVE |
| | `rebuild_index` | ACTIVE |
| | `begin_transaction` | ACTIVE |
| | `commit_transaction` | ACTIVE |
| | `rollback_transaction` | ACTIVE |
| **query_command.rs** | `query_execute` | ACTIVE |
| | `query_save` | ACTIVE |
| | `query_delete` | ACTIVE |
| | `query_raw` | ACTIVE |
| | `query_aggregate` | ACTIVE |
| | `query_server_version` | ACTIVE |
| **rbac_command.rs** | `login` | ACTIVE |
| | `logout` | ACTIVE |
| | `register` | ACTIVE |
| | `get_current_user` | ACTIVE |
| | `rbac_list_roles` | ACTIVE |
| | `rbac_create_role` | ACTIVE |
| | `rbac_delete_role` | ACTIVE |
| | `rbac_list_permissions` | ACTIVE |
| | `rbac_create_permission` | ACTIVE |
| | `rbac_delete_permission` | ACTIVE |
| | `rbac_assign_role_to_user` | ACTIVE |
| | `rbac_remove_role_from_user` | ACTIVE |
| | `rbac_grant_permission` | ACTIVE |
| | `rbac_revoke_permission` | ACTIVE |
| | `rbac_get_user_roles` | ACTIVE |
| | `rbac_get_role_permissions` | ACTIVE |
| **cloud_sync_command.rs** | `sync_schema_to_cloud` | ACTIVE |
| | `pull_schema_from_cloud` | ACTIVE |
| | `list_cloud_schemas` | ACTIVE |
| **settings_command.rs** | `init_decentralized_storage` | ACTIVE |
| | `save_database_metadata` | ACTIVE |
| | `list_databases_metadata` | ACTIVE |
| | `get_database_metadata` | ACTIVE |
| | `update_database_metadata` | ACTIVE |
| | `delete_database_metadata` | ACTIVE |
| | `delete_connection_databases_metadata` | ACTIVE |
| | `get_system_status` | ACTIVE |
| | `save_log_file` | ACTIVE |
| | `append_log_file` | ACTIVE |
| **sync_command.rs** | `pull_schema` | ACTIVE |
| | `get_cached_schema` | ACTIVE |
| | `clear_schema_cache` | ACTIVE |
| | `save_to_local_cache` | ACTIVE |
| **screenshot_command.rs** | `capture_screenshot` | ACTIVE |

### Unmigrated GAP Commands

**None** — all source commands are represented in the AS-IS diagram.

### Dead Commands

**None** — no commands in the AS-IS diagram are absent from the source.

---

## Handler Type Assignments

The TO-BE diagram specifies KAS handler types for each command. Below is the mapping based on naming conventions and command semantics.

> **Note:** The TO-BE diagram shows `navigate`, `set`, `toast`, `modal`, and `guard` handlers that do not yet exist as actual KAS handler functions in the source. These are **migration targets**, not existing code.

### Handler Type Reference

| Handler Type | Stereotype | Purpose |
|-------------|-----------|---------|
| `invoke` | `<<invoke>>` | Standard command — returns data, no side effects on navigation/state |
| `navigate` | `<<navigate>>` | Triggers page/route navigation |
| `set` | `<<set>>` | Mutates frontend reactive state (signals) |
| `toast` | `<<toast>>` | Shows a toast/notification |
| `modal` | `<<modal>>` | Opens a confirmation dialog |
| `guard` | `<<guard>>` | Auth/RBAC check before action |

### Command → Handler Type Mapping

| Command | Handler Type | Rationale |
|---------|-------------|-----------|
| `save_connection` | invoke | Persists connection config |
| `list_connections` | invoke | Reads connection list |
| `get_connection` | invoke | Reads single connection |
| `delete_connection` | invoke | Deletes connection |
| `update_connection` | invoke | Updates connection config |
| `test_connection` | invoke | Tests connectivity |
| `test_connection_status` | invoke | Gets connection health status |
| `check_health` | invoke | Health check |
| `create_database` | invoke | Creates database |
| `rename_database` | invoke | Renames database |
| `delete_database` | invoke | Deletes database |
| `database_list` | invoke | Lists databases |
| `collection_list` | invoke | Lists collections |
| `collection_stats` | invoke | Gets collection stats |
| `collection_create` | invoke | Creates collection |
| `collection_drop` | invoke | Drops collection |
| `collection_rename` | invoke | Renames collection |
| `describe_collection` | invoke | Describes schema |
| `get_ui_schema` | invoke | Returns UI schema JSON |
| `initialize_app` | invoke | Initializes app (no-op) |
| `get_version` | invoke | Returns app version |
| `is_connected` | invoke | Returns connection status |
| `insert_document` | invoke | Inserts document |
| `update_document` | invoke | Updates document |
| `delete_document` | invoke | Deletes document |
| `soft_delete_document` | invoke | Soft-deletes document |
| `create_index` | invoke | Creates index |
| `drop_index` | invoke | Drops index |
| `rebuild_index` | invoke | Rebuilds index |
| `begin_transaction` | invoke | Begins transaction |
| `commit_transaction` | invoke | Commits transaction |
| `rollback_transaction` | invoke | Rolls back transaction |
| `query_execute` | invoke | Executes query |
| `query_save` | invoke | Saves query result |
| `query_delete` | invoke | Deletes via query |
| `query_raw` | invoke | Executes raw SQL |
| `query_aggregate` | invoke | Runs aggregation |
| `query_server_version` | invoke | Gets server version |
| `login` | guard | Auth guard — validates credentials, creates session |
| `logout` | guard | Auth guard — invalidates session |
| `register` | guard | Auth guard — creates user |
| `get_current_user` | invoke | Gets current user from session |
| `rbac_list_roles` | invoke | Lists roles |
| `rbac_create_role` | invoke | Creates role |
| `rbac_delete_role` | invoke | Deletes role |
| `rbac_list_permissions` | invoke | Lists permissions |
| `rbac_create_permission` | invoke | Creates permission |
| `rbac_delete_permission` | invoke | Deletes permission |
| `rbac_assign_role_to_user` | invoke | Assigns role to user |
| `rbac_remove_role_from_user` | invoke | Removes role from user |
| `rbac_grant_permission` | invoke | Grants permission to role |
| `rbac_revoke_permission` | invoke | Revokes permission from role |
| `rbac_get_user_roles` | invoke | Gets user's roles |
| `rbac_get_role_permissions` | invoke | Gets role's permissions |
| `sync_schema_to_cloud` | invoke | Syncs schema to cloud |
| `pull_schema_from_cloud` | invoke | Pulls schema from cloud |
| `list_cloud_schemas` | invoke | Lists cloud schemas |
| `init_decentralized_storage` | invoke | Initializes storage |
| `save_database_metadata` | invoke | Saves metadata |
| `list_databases_metadata` | invoke | Lists metadata |
| `get_database_metadata` | invoke | Gets metadata |
| `update_database_metadata` | invoke | Updates metadata |
| `delete_database_metadata` | invoke | Deletes metadata |
| `delete_connection_databases_metadata` | invoke | Deletes all metadata for connection |
| `get_system_status` | invoke | Gets system metrics |
| `save_log_file` | invoke | Saves log file |
| `append_log_file` | invoke | Appends to log file |
| `pull_schema` | invoke | Pulls schema (sync) |
| `get_cached_schema` | invoke | Gets cached schema |
| `clear_schema_cache` | invoke | Clears schema cache |
| `save_to_local_cache` | invoke | Saves to local cache |
| `capture_screenshot` | invoke | Captures screenshot |

### Planned-but-Absent Handlers (TO-BE Targets)

These handlers appear in the TO-BE diagram but have **no corresponding implementation** in the current Tauri source:

| Handler | Type | Status |
|---------|------|--------|
| `navigate_to_connection` | navigate | **TARGET** — needs new KAS navigate handler |
| `navigate_to_schema_editor` | navigate | **TARGET** — needs new KAS navigate handler |
| `navigate_to_query` | navigate | **TARGET** — needs new KAS navigate handler |
| `set_active_connection` | set | **TARGET** — needs new KAS set handler |
| `set_query_result` | set | **TARGET** — needs new KAS set handler |
| `set_collection_schema` | set | **TARGET** — needs new KAS set handler |
| `show_success_toast` | toast | **TARGET** — needs new KAS toast handler |
| `show_error_toast` | toast | **TARGET** — needs new KAS toast handler |
| `show_warning_toast` | toast | **TARGET** — needs new KAS toast handler |
| `confirm_delete_connection` | modal | **TARGET** — needs new KAS modal handler |
| `confirm_drop_collection` | modal | **TARGET** — needs new KAS modal handler |
| `confirm_delete_database` | modal | **TARGET** — needs new KAS modal handler |
| `auth_guard` | guard | **TARGET** — not a separate handler; auth is inline in `login`/`logout`/`register` |
| `rbac_guard` | guard | **TARGET** — not a separate handler; RBAC logic is in `dioxus-shared` |

---

## State Migration

### Current: AppState (Tauri)

**File:** `src-tauri/src/state.rs`

```rust
pub struct AppState {
  pub connection_service: Arc<ConnectionService>,
  #[allow(dead_code)]
  pub app_handle: Arc<Mutex<AppHandle>>,
}
```

**Services:**
- `Arc<ConnectionService>` — manages database connections

### Target: Dioxus Signals

The Dioxus frontend uses reactive signals instead of `State<'_, AppState>`. Each service field maps to a signal or a context provider.

| Current AppState Field | Dioxus Target | Migration Action |
|-----------------------|---------------|------------------|
| `Arc<ConnectionService>` | `ConnectionService` singleton | Register as Dioxus `Arc<Service>` via `use_service()` / `provide_context()` |
| `Arc<Mutex<AppHandle>>` | `Window` context | Replace with Dioxus `use_window()` or `use_tauri_event()` |
| `TransactionRegistry` (static in `ipc_commands.rs`) | `Signal<HashMap<TransactionId, ConnectionId>>` | Migrate from `static` to Dioxus signal |
| `RBAC_JSON_PROVIDER` (static in `rbac.command.rs`) | `Arc<JsonProvider>` via context | Register as service context |

### Service Registration (Tauri → Dioxus)

| Tauri Registration | Dioxus Equivalent |
|--------------------|--------------------|
| `app.manage(app_state)` in `lib.rs` | `provide_context(connection_service.clone())` in `main.rsx` |
| `State<'_, AppState>` in commands | `use_context::<ConnectionService>()` in Dioxus components |
| `Arc<ConnectionService>` singleton | `ConnectionService::get_instance().await` remains, exposed via context |

---

## Entity DDD Modeling

### Current Entities

**File:** `src-tauri/src/commands/connection-entity.command.rs`

```rust
pub struct ConnectionEntity {
  pub id: Option<String>,
  pub type_: String,       // renamed from `type_col` (reserved keyword)
  pub name: String,
  pub config: String,       // JSON-serialized ConnectionConfig
  pub created_at: Option<DateTime<Utc>>,
  pub updated_at: Option<DateTime<Utc>>,
}
```

**File:** `src-tauri/src/commands/connection.command.rs`

```rust
pub enum ConnectionConfigEnum {
  Json { name: String, path: String },
  Mongo { name: String, uri: String, database: String },
  Redis { name: String, uri: String, database: String },
  Postgres { name: String, uri: String },
  Sqlite { name: String, path: String },
  MySql { name: String, uri: String },
}

pub struct ConnectionConfig {
  pub name: String,
  pub config: ConnectionConfigEnum,
}

pub struct ConnectionSummary { id, name, provider, status }
pub struct ConnectionHealth { healthy, provider, server_version, latency_ms }
```

**File:** `src-tauri/src/commands/settings.command.rs`

```rust
pub struct DatabaseMetadata {
  pub id: i64,
  pub connection_id: String,
  pub name: String,
  pub path: Option<String>,
  pub created_at: i64,
  pub updated_at: i64,
  pub metadata: Option<String>,
}
```

**File:** `src-tauri/src/commands/types.command.rs`

```rust
pub struct CollectionMeta { name, count }
pub struct ColumnInfo { name, data_type, nullable, is_primary_key }
pub struct IndexInfo { name, columns, is_unique }
pub struct CollectionSchema { name, columns, indexes }
pub struct CollectionStats { name, document_count, size_bytes, index_count }
pub struct DatabaseMeta { name, size_bytes, table_count }
```

### DDD Target Model

#### Domain Entities (have identity, live in aggregate)

| Entity | Aggregate Root | Fields | Notes |
|--------|---------------|--------|-------|
| `Connection` | ✅ Yes | `id`, `name`, `type_`, `config` | `config` is a Value Object `ConnectionConfig` |
| `DatabaseMetadata` | ✅ Yes | `id`, `connection_id`, `name`, `path`, `metadata` |  |
| `Transaction` | ✅ Yes | `transaction_id`, `connection_id` | Currently a static registry; needs entity |

#### Value Objects (no identity, immutable)

| Value Object | Fields | Notes |
|-------------|--------|-------|
| `ConnectionConfig` | `name`, `config: ConnectionConfigEnum` | Enum with 6 variants (Json, Mongo, Redis, Postgres, Sqlite, MySql) |
| `ConnectionHealth` | `healthy`, `provider`, `server_version`, `latency_ms` | |
| `CollectionMeta` | `name`, `count` | |
| `ColumnInfo` | `name`, `data_type`, `nullable`, `is_primary_key` | |
| `IndexInfo` | `name`, `columns`, `is_unique` | |
| `CollectionStats` | `name`, `document_count`, `size_bytes`, `index_count` | |
| `DatabaseMeta` | `name`, `size_bytes`, `table_count` | |
| `SystemMetrics` | `cpu_usage`, `ram_used`, `ram_total`, `disk_used`, `disk_total`, `network_received`, `network_transmitted`, `uptime`, `status` | |
| `TransactionResult` | `transaction_id` | |

#### DTOs vs Entities

| Name | Current Type | DDD Role | Migration |
|------|-------------|----------|-----------|
| `ConnectionSummary` | struct | DTO | Read model for connection lists |
| `CollectionListResult` | struct | DTO | Paginated list of collections |
| `DatabaseListResult` | struct | DTO | Paginated list of databases |
| `QueryParams` | struct | DTO | Query input |
| `QueryResult<T>` | generic struct | DTO | Query output |
| `RawResult` | struct | DTO | Raw SQL result |

### Gap: No Explicit Domain Layer

**Current:** Commands directly use `ConnectionService` and `NosqlOrmAdapter`. There is no `domain/` layer separating business logic from infrastructure.

**Target DDD Structure:**
```
src-tauri/src/
  domain/
    entities/
      connection.rs      # Connection aggregate
      database_metadata.rs
    value_objects/
      connection_config.rs
      collection_meta.rs
      # ... etc
    repositories/
      connection_repository.rs   # trait定义
    services/
      connection_domain_service.rs
  application/
    commands/             # KAS handlers (migrated)
    queries/
  infrastructure/
    persistence/
      sqlite_connection_repo.rs
```

---

## Migration Phases

### Phase 1: DDD Entity Modeling

**Goal:** Extract domain entities and value objects from command modules into a proper `domain/` layer.

#### Actions

1. **Create `src-tauri/src/domain/` directory structure**
   ```
   domain/
     entities/
       connection.rs
       database_metadata.rs
     value_objects/
       connection_config.rs
       collection_meta.rs
       column_info.rs
       index_info.rs
       collection_stats.rs
       database_meta.rs
       system_metrics.rs
     repositories/
       connection_repository.rs   # Repository trait
     services/
       connection_domain_service.rs
   ```

2. **Extract `ConnectionEntity` → `domain/entities/connection.rs`**
   - Keep `id`, `type_`, `name`, `config`, `created_at`, `updated_at`
   - Add `validate()` method
   - Rename `type_` → `provider_type` (cleaner)

3. **Extract `ConnectionConfigEnum` → `domain/value_objects/connection_config.rs`**
   - Convert from Rust enum to DDD Value Object
   - Implement `Validation` trait

4. **Extract `DatabaseMetadataEntity` → `domain/entities/database_metadata.rs`**

5. **Extract remaining types to value objects**:
   - `CollectionMeta`, `ColumnInfo`, `IndexInfo`, `CollectionSchema`, `CollectionStats` → `domain/value_objects/`
   - `DatabaseMeta` → `domain/value_objects/`
   - `SystemMetrics` → `domain/value_objects/`
   - `TransactionResult` → `domain/value_objects/`

6. **Define repository traits**:
   - `trait ConnectionRepository { find_by_id, save, delete, list }`
   - `trait DatabaseMetadataRepository { find_by_id, find_by_connection_id, save, delete }`

7. **Create `domain/services/` for business logic currently embedded in commands**

#### Deliverables

- `src-tauri/src/domain/` directory with entity and value object files
- Repository traits defined
- Domain services extracted

#### Verification Checklist

- [ ] `ConnectionEntity` moved to `domain/entities/connection.rs`
- [ ] `ConnectionConfigEnum` moved to `domain/value_objects/connection_config.rs`
- [ ] `DatabaseMetadataEntity` moved to `domain/entities/database_metadata.rs`
- [ ] All value objects in `domain/value_objects/`
- [ ] Repository traits defined (not implemented yet)
- [ ] No domain types in `commands/` directory
- [ ] Code compiles with `cargo check`

---

### Phase 2: KAS Handler Migration

**Goal:** Replace `#[tauri::command]` functions with `#[kas_handler]` functions using the KAS framework, maintaining identical business logic.

#### Actions

1. **Install/Configure KAS**
   - Add `kas` and `kas-shared` dependencies to `src-tauri/Cargo.toml`
   - Configure `kas.toml` if needed

2. **Create handler modules**:
   ```
   src-tauri/src/
     handlers/
       invoke/
         connection_handlers.rs   # save_connection, list_connections, etc.
         database_handlers.rs
         schema_handlers.rs
         query_handlers.rs
         ipc_handlers.rs
         rbac_handlers.rs
         cloud_sync_handlers.rs
         settings_handlers.rs
         sync_handlers.rs
         screenshot_handlers.rs
       navigate/
         mod.rs
       set/
         mod.rs
       toast/
         mod.rs
       modal/
         mod.rs
       guard/
         mod.rs
   ```

3. **Migrate commands group by group** (connections → database → schema → query → IPC → RBAC → settings → sync → screenshot)

   For each command, convert:
   ```rust
   // BEFORE (Tauri)
   #[tauri::command]
   pub async fn save_connection(
     state: State<'_, AppState>,
     config: ConnectionConfig,
   ) -> Result<ResponseModel, String> { ... }
   ```
   ```rust
   // AFTER (KAS)
   #[kas_handler]
   pub async fn save_connection(
     connection_service: ConnectionService,
     config: ConnectionConfig,
   ) -> Result<ResponseModel, String> { ... }
   ```

4. **Create new KAS handlers for absent TO-BE handlers**:
   - `navigate_to_connection`, `navigate_to_schema_editor`, `navigate_to_query` → `handlers/navigate/`
   - `set_active_connection`, `set_query_result`, `set_collection_schema` → `handlers/set/`
   - `show_success_toast`, `show_error_toast`, `show_warning_toast` → `handlers/toast/`
   - `confirm_delete_connection`, `confirm_drop_collection`, `confirm_delete_database` → `handlers/modal/`
   - `auth_guard` as `guard/login`, `guard/logout`, `guard/register`
   - `rbac_guard` as inline RBAC checks in relevant handlers

5. **Wire KAS router in `lib.rs`**:
   ```rust
   use kas::Kas;
   // Replace tauri::generate_handler![] with KAS router
   ```

6. **Remove old `#[tauri::command]` attributes** from command functions

#### Deliverables

- All 71 commands migrated to `#[kas_handler]`
- 11 new KAS handlers for TO-BE targets (navigate: 3, set: 3, toast: 3, modal: 3)
- `handlers/` module structure in place
- KAS router wired in `lib.rs`

#### Verification Checklist

- [ ] All 71 `#[tauri::command]` → `#[kas_handler]`
- [ ] All 11 new KAS handlers implemented
- [ ] No `#[tauri::command]` remaining in `commands/` directory
- [ ] `lib.rs` uses KAS router
- [ ] `cargo check` passes
- [ ] Integration tests pass for each handler group

---

### Phase 3: State Signal Migration

**Goal:** Replace `AppState` (Tauri-managed state) with Dioxus signals and context providers.

#### Actions

1. **Create Dioxus service context providers**:
   ```
   frontend/src/
     services/
       connection_service.rs    # Arc<ConnectionService> exposed as context
       app_context.rsx          # Root provider component
   ```

2. **Migrate `AppState` fields**:
   - `Arc<ConnectionService>` → `provide_context(connection_service.clone())`
   - `Arc<Mutex<AppHandle>>` → `use_tauri_window()` or `use_platform_window()`

3. **Migrate static transaction registry** (`TRANSACTION_REGISTRY` in `ipc_commands.rs`):
   - Convert from `static` global to `Signal<HashMap<String, String>>` at app root
   - Provide via `provide_context(transaction_registry_signal)`

4. **Migrate RBAC provider** (`RBAC_JSON_PROVIDER` in `rbac.command.rs`):
   - Convert from `static OnceCell` to service context
   - Provide via `provide_context(rbac_service.clone())`

5. **Create `AppState` replacement in Dioxus**:
   ```rust
   // frontend/src/services/app_context.rsx
   fn AppProvider() {
     let connection_service = use_service::<ConnectionService>();
     let transaction_registry = use_signal(HashMap::<String, String>::new);
     let rbac_service = use_service::<RbacService>();

     provide_context(connection_service.clone());
     provide_context(transaction_registry);
     provide_context(rbac_service.clone());
     // ...
   }
   ```

6. **Update handler signatures** to use Dioxus context injection instead of `State<'_, AppState>`:
   ```rust
   // BEFORE
   pub async fn save_connection(state: State<'_, AppState>, config: ConnectionConfig)
   // AFTER (via context)
   pub async fn save_connection(connection_service: ConnectionService, config: ConnectionConfig)
   ```

7. **Handle `AppHandle` usage**:
   - Replace `app_handle.clone()` patterns with `use_platform_window()` from Dioxus
   - Update screenshot command to use Dioxus screenshot API

#### Deliverables

- `frontend/src/services/` with context providers
- All Tauri state references replaced with Dioxus signals
- Transaction registry as reactive signal
- RBAC provider as Dioxus context

#### Verification Checklist

- [ ] `AppState` removed from `src-tauri/src/state.rs`
- [ ] No `State<'_, AppState>` in handlers
- [ ] `TRANSACTION_REGISTRY` converted to signal
- [ ] `RBAC_JSON_PROVIDER` converted to context
- [ ] Screenshot command works via Dioxus API
- [ ] App builds and renders without Tauri state errors

---

### Phase 4: Frontend Completion

**Goal:** Complete the Dioxus frontend integration, replacing all Tauri IPC calls with KAS handler invocations.

#### Actions

1. **Update Dioxus frontend to use KAS handlers**
   - Replace `invoke::<T>("command_name", ...)` calls with `use_handler::<T>("command_name")` or equivalent KAS client
   - Generate TypeScript bindings from KAS handler signatures

2. **Wire up navigate handlers**
   - Connect `navigate_to_connection` → Dioxus router `Router::push("/connections/:id")`
   - Connect `navigate_to_schema_editor` → Dioxus router `Router::push("/schema/:collection")`
   - Connect `navigate_to_query` → Dioxus router `Router::push("/query/:connectionId")`

3. **Wire up set handlers**
   - `set_active_connection` → updates `active_connection_signal`
   - `set_query_result` → updates `query_result_signal`
   - `set_collection_schema` → updates `collection_schema_signal`

4. **Wire up toast handlers**
   - `show_success_toast` → toast notification system
   - `show_error_toast` → error toast
   - `show_warning_toast` → warning toast

5. **Wire up modal handlers**
   - `confirm_delete_connection` → confirmation dialog component
   - `confirm_drop_collection` → confirmation dialog component
   - `confirm_delete_database` → confirmation dialog component

6. **Remove Tauri-specific frontend code**
   - Remove `tauri::invoke` calls
   - Remove `State<AppState>` usage in components
   - Replace with Dioxus-native patterns

7. **Final integration testing**
   - End-to-end tests for critical paths (connection CRUD, query execution, RBAC)
   - Manual testing of navigate/set/toast/modal handlers

#### Deliverables

- Frontend fully uses KAS handler invocations
- All navigate/set/toast/modal handlers wired to UI
- No `tauri::invoke` remaining in frontend
- E2E tests pass

#### Verification Checklist

- [ ] No `tauri::invoke` calls in frontend
- [ ] All navigate handlers route correctly
- [ ] All set handlers update reactive state
- [ ] All toast handlers show notifications
- [ ] All modal handlers show confirmation dialogs
- [ ] E2E tests pass for connection CRUD
- [ ] E2E tests pass for query execution
- [ ] E2E tests pass for RBAC login/logout/register

---

## Verification Checklist

### Pre-Migration

- [ ] Current codebase compiles with `cargo build --release`
- [ ] All 71 commands are reachable via Tauri IPC
- [ ] Frontend builds and runs in development mode
- [ ] No `TODO` or `FIXME` in `src-tauri/src/commands/`
- [ ] `src-tauri/src/state.rs` reviewed and understood

### Post-Phase-1 (DDD Entity Modeling)

- [ ] `src-tauri/src/domain/` directory exists with all entity/value object files
- [ ] All domain types have proper DDD annotations (if using any)
- [ ] Repository traits defined
- [ ] `cargo check` passes
- [ ] Commands still work (integration test)

### Post-Phase-2 (KAS Handler Migration)

- [ ] All `#[tauri::command]` replaced with `#[kas_handler]`
- [ ] All 11 new KAS handlers implemented
- [ ] No `State<'_, AppState>` in handlers
- [ ] KAS router replaces `tauri::generate_handler![]`
- [ ] `cargo check --release` passes
- [ ] `cargo test` passes

### Post-Phase-3 (State Signal Migration)

- [ ] `AppState` struct removed from `state.rs`
- [ ] `TRANSACTION_REGISTRY` migrated to signal
- [ ] `RBAC_JSON_PROVIDER` migrated to context
- [ ] All handlers use Dioxus context injection
- [ ] Frontend builds without Tauri state errors
- [ ] Dioxus app renders correctly

### Post-Phase-4 (Frontend Completion)

- [ ] All navigate handlers wired to router
- [ ] All set handlers update signals
- [ ] All toast handlers show notifications
- [ ] All modal handlers show dialogs
- [ ] No `tauri::invoke` in frontend
- [ ] E2E tests pass (connection CRUD, query, RBAC)
- [ ] Application runs in production mode

---

## Appendix: Command Signatures

### connection_command.rs

| Command | Signature |
|---------|-----------|
| `save_connection` | `config: ConnectionConfig` → `Result<ResponseModel, String>` |
| `list_connections` | `()` → `Result<ResponseModel, String>` |
| `get_connection` | `id: &str` → `Result<ResponseModel, String>` |
| `delete_connection` | `id: &str` → `Result<ResponseModel, String>` |
| `update_connection` | `id: &str, config: ConnectionConfig` → `Result<ResponseModel, String>` |
| `test_connection` | `config: ConnectionConfig` → `Result<ResponseModel, String>` |
| `test_connection_status` | `id: &str` → `Result<ResponseModel, String>` |
| `check_health` | `connection_id: &str` → `Result<ResponseModel, String>` |

### database_command.rs

| Command | Signature |
|---------|-----------|
| `create_database` | `connection_id: &str, name: &str` → `Result<ResponseModel, String>` |
| `rename_database` | `connection_id: &str, old_name: &str, new_name: &str` → `Result<ResponseModel, String>` |
| `delete_database` | `connection_id: &str, name: &str` → `Result<ResponseModel, String>` |
| `database_list` | `conn_id: String, offset: Option<usize>, limit: Option<usize>` → `Result<ResponseModel, String>` |

### schema_command.rs

| Command | Signature |
|---------|-----------|
| `collection_list` | `conn_id: String, db_name: Option<String>, offset: Option<usize>, limit: Option<usize>` → `Result<ResponseModel, String>` |
| `collection_stats` | `connection_id: String, name: String` → `Result<ResponseModel, String>` |
| `collection_create` | `connection_id: String, name: String` → `Result<ResponseModel, String>` |
| `collection_drop` | `connection_id: String, name: String` → `Result<ResponseModel, String>` |
| `collection_rename` | `connection_id: String, db_name: Option<String>, oldName: String, newName: String` → `Result<ResponseModel, String>` |
| `describe_collection` | `connection_id: &str, collection: &str` → `Result<ResponseModel, String>` |
| `get_ui_schema` | `()` → `Result<String, String>` |

### ipc_commands.rs

| Command | Signature |
|---------|-----------|
| `initialize_app` | `()` → `Result<(), String>` |
| `get_version` | `()` → `Result<String, String>` |
| `is_connected` | `()` → `Result<bool, String>` |
| `insert_document` | `conn_id: String, collection: String, data: Value` → `Result<Value, String>` |
| `update_document` | `conn_id: String, collection: String, id: String, data: Value` → `Result<Value, String>` |
| `delete_document` | `conn_id: String, collection: String, id: String` → `Result<(), String>` |
| `soft_delete_document` | `conn_id: String, collection: String, id: String` → `Result<(), String>` |
| `create_index` | `conn_id: String, collection: String, index_definition: Value` → `Result<(), String>` |
| `drop_index` | `conn_id: String, collection: String, index_name: String` → `Result<(), String>` |
| `rebuild_index` | `conn_id: String, collection: String, index_name: String` → `Result<(), String>` |
| `begin_transaction` | `conn_id: String, _isolation_level: Option<String>` → `Result<TransactionResult, String>` |
| `commit_transaction` | `transaction_id: String` → `Result<(), String>` |
| `rollback_transaction` | `transaction_id: String` → `Result<(), String>` |

### query_command.rs

| Command | Signature |
|---------|-----------|
| `query_execute` | `connectionId: String, collection: String, params: QueryParams` → `Result<Response<QueryResult<Value>>, String>` |
| `query_save` | `connectionId: String, collection: String, data: Value` → `Result<ResponseModel, String>` |
| `query_delete` | `connectionId: String, collection: String, id: String` → `Result<(), String>` |
| `query_raw` | `connectionId: String, sql: String` → `Result<RawResult, String>` |
| `query_aggregate` | `connectionId: String, collection: String, pipeline: Vec<Value>` → `Result<Response<Vec<Value>>, String>` |
| `query_server_version` | `connectionId: String` → `Result<String, String>` |

### rbac_command.rs

| Command | Signature |
|---------|-----------|
| `login` | `username: String, password: String` → `Result<ResponseModel, String>` |
| `logout` | `session_token: String` → `Result<ResponseModel, String>` |
| `register` | `username: String, password: String, email: String` → `Result<ResponseModel, String>` |
| `get_current_user` | `session_token: String` → `Result<ResponseModel, String>` |
| `rbac_list_roles` | `()` → `Result<ResponseModel, String>` |
| `rbac_create_role` | `name: String, description: String` → `Result<ResponseModel, String>` |
| `rbac_delete_role` | `role_id: String` → `Result<ResponseModel, String>` |
| `rbac_list_permissions` | `()` → `Result<ResponseModel, String>` |
| `rbac_create_permission` | `name: String, resource: String, action: String` → `Result<ResponseModel, String>` |
| `rbac_delete_permission` | `perm_id: String` → `Result<ResponseModel, String>` |
| `rbac_assign_role_to_user` | `user_id: String, role_id: String` → `Result<ResponseModel, String>` |
| `rbac_remove_role_from_user` | `user_id: String, role_id: String` → `Result<ResponseModel, String>` |
| `rbac_grant_permission` | `role_id: String, perm_id: String` → `Result<ResponseModel, String>` |
| `rbac_revoke_permission` | `role_id: String, perm_id: String` → `Result<ResponseModel, String>` |
| `rbac_get_user_roles` | `user_id: String` → `Result<ResponseModel, String>` |
| `rbac_get_role_permissions` | `role_id: String` → `Result<ResponseModel, String>` |

### cloud_sync_command.rs

| Command | Signature |
|---------|-----------|
| `sync_schema_to_cloud` | `id: String, name: String, version: String, schema_json: Value` → `Result<ResponseModel, String>` |
| `pull_schema_from_cloud` | `id: String` → `Result<ResponseModel, String>` |
| `list_cloud_schemas` | `()` → `Result<ResponseModel, String>` |

### settings_command.rs

| Command | Signature |
|---------|-----------|
| `init_decentralized_storage` | `()` → `Result<(), String>` |
| `save_database_metadata` | `connection_id: String, name: String, path: Option<String>, metadata: Option<String>` → `Result<DatabaseMetadata, String>` |
| `list_databases_metadata` | `connection_id: String` → `Result<Vec<DatabaseMetadata>, String>` |
| `get_database_metadata` | `id: i64` → `Result<Option<DatabaseMetadata>, String>` |
| `update_database_metadata` | `id: i64, name: String, path: Option<String>, metadata: Option<String>` → `Result<DatabaseMetadata, String>` |
| `delete_database_metadata` | `id: i64` → `Result<(), String>` |
| `delete_connection_databases_metadata` | `connection_id: String` → `Result<(), String>` |
| `get_system_status` | `()` → `Result<ResponseModel, String>` |
| `save_log_file` | `filename: String, data: String` → `Result<ResponseModel, String>` |
| `append_log_file` | `data: String` → `Result<ResponseModel, String>` |

### sync_command.rs

| Command | Signature |
|---------|-----------|
| `pull_schema` | `mongo_uri: String, database_name: String, collection_name: String, schema_id: String` → `Result<ResponseModel, String>` |
| `get_cached_schema` | `app_id: String` → `Result<ResponseModel, String>` |
| `clear_schema_cache` | `app_id: String` → `Result<ResponseModel, String>` |
| `save_to_local_cache` | `app_id: String, schema: Value` → `Result<ResponseModel, String>` |

### screenshot_command.rs

| Command | Signature |
|---------|-----------|
| `capture_screenshot` | `_app: AppHandle` → `Result<ScreenshotResult, String>` |

---

## Appendix: AppState Structure

**File:** `src-tauri/src/state.rs`

```rust
pub struct AppState {
  pub connection_service: Arc<ConnectionService>,  // Singleton for connection management
  #[allow(dead_code)]
  pub app_handle: Arc<Mutex<AppHandle>>,           // Tauri app handle (unused in most commands)
}

impl AppState {
  pub async fn new(app_handle: AppHandle) -> Result<Self, String> {
    let connection_service = ConnectionService::get_instance().await;
    Ok(Self {
      connection_service,
      app_handle: Arc::new(Mutex::new(app_handle)),
    })
  }
}
```

**Initialization** (`lib.rs`):
```rust
let app_state = tauri::async_runtime::block_on(AppState::new(app.handle().clone())).map_err(|e| e)?;
app.manage(app_state);
```

**Service Dependencies:**
- `ConnectionService` — singleton, manages all database connections (Json, Mongo, Redis, Postgres, Sqlite, MySql providers)
- No other services currently in `AppState`

**Static Registries (not in AppState, but command-scoped):**
- `TRANSACTION_REGISTRY` in `ipc_commands.rs` — `static OnceLock<Arc<RwLock<HashMap<String, String>>>>`
- `RBAC_JSON_PROVIDER` in `rbac.command.rs` — `static OnceCell<Arc<RwLock<Option<nosql_orm::providers::JsonProvider>>>>`

---

## Appendix: Handler Type Taxonomy

### invoke Handler
- Replaces `#[tauri::command]` for pure data operations
- Signature: `(service, params) -> Result<T, String>`
- No side effects on navigation or UI state
- Example: `save_connection`, `query_execute`, `rbac_list_roles`

### navigate Handler
- Triggers client-side route change
- Returns nothing (unit) or navigation result
- Must be called from UI event handler
- Example: `navigate_to_connection` → routes to `/connections/:id`

### set Handler
- Mutates a reactive Dioxus signal
- Returns `Result<(), String>`
- Does NOT persist data (that's an invoke)
- Example: `set_active_connection` → updates `active_connection_signal`

### toast Handler
- Shows a transient notification
- Returns `Result<(), String>`
- Parameters: `message: String`, optional `duration: u64`
- Example: `show_success_toast("Connection saved")`

### modal Handler
- Opens a blocking confirmation dialog
- Returns `Result<bool, String>` (true = confirmed, false = cancelled)
- Parameters: `title: String`, `message: String`
- Example: `confirm_delete_connection("Delete connection 'prod-db'?")`

### guard Handler
- Pre-flight authorization check
- Returns `Result<bool, String>` (true = allowed, false = denied with message)
- Wraps another handler or page access
- Examples: `auth_guard` (checks session), `rbac_guard` (checks permission)

---

*Plan generated by arch-plan from /home/dmitriy/Projects/ZenithDB*
