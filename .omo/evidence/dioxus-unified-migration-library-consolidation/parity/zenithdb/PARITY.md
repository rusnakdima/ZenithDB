# ZenithDB Parity Report

## Overview

- **App**: ZenithDB
- **Schema Version**: 1.0.0
- **Git History**: 400 total commits | 135 src-tauri commits | ~271 Angular commits
- **Generated**: 2026-08-18
- **Status**: DIVERGENT - requires Response fix

---

## 1. Current State: Response Divergence

### 1.1 Divergent Response Implementation

ZenithDB defines its own `Response<T>` with `status: String` instead of using the unified `Status` enum from `dioxus-shared`.

**Current (Divergent)**: `ZenithDB/src/lib.rs` lines 33-38:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Response<T> {
    pub status: String,        // ❌ DIVERGENT: String instead of Status enum
    pub message: Option<String>,
    pub data: T,
}
```

**Correct (Unified)**: `dioxus-shared/src/response.rs` lines 22-28:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Response<T> {
    pub status: Status,         // ✅ CORRECT: Status enum
    pub message: String,       // ✅ Required, not Option
    pub data: Option<T>,        // ✅ Option-wrapped
}
```

### 1.2 Status Enum (Unified)

The `dioxus-shared` defines a proper `Status` enum (lines 5-20):
```rust
pub enum Status {
    Success,
    Created,
    Updated,
    Deleted,
    Error,
    ValidationError,
    NotFound,
    Unauthorized,
    Forbidden,
    Info,
    Warning,
    Duplicate,
}
```

### 1.3 Impact

**Files with `status: String`** (7 occurrences in 4 source files):
| File | Line | Field |
|------|------|-------|
| `ZenithDB/src/lib.rs` | 35 | `Response.status` |
| `ZenithDB/src/lib.rs` | 75 | `Response::default()` |
| `ZenithDB/src/application/commands/connection_commands.rs` | 17 | `ConnectionListItem.status` |
| `ZenithDB/src/domain/entities/connection.rs` | 53 | `ConnectionSummary.status` |
| `ZenithDB/diagrams/as-is/05-entities.puml` | 73 | Diagram reference |

---

## 2. Old Surfaces from Git History

### 2.1 Tauri Backend (src-tauri) - 135 commits

**Key commits showing old surface evolution:**

| Commit | Message | Response Pattern |
|--------|---------|------------------|
| `247bdc7` | fix: ZenithDB Response data-first + delete local wrapper (ISS-001, ISS-002) | ✅ Used `tauri_shared::response::{Response, Status}` |
| `75e3862` | chore: command updates, connection/cloud services... | ❌ Started local Response wrapper |
| `78a0f72` | refactor(zenithdb): update Rust schema and errors | Local error wrapper |
| `247bdc7^` | Parent of Response fix - used proper `tauri_shared::response` | ✅ Correct pattern |

**Old src-tauri command surface (82 command files across commits):**
- `src-tauri/src/commands/crud.macro.rs`
- `src-tauri/src/commands/database.command.rs`
- `src-tauri/src/commands/query.command.rs`
- `src-tauri/src/commands/rbac.command.rs`
- `src-tauri/src/commands/schema.command.rs`
- `src-tauri/src/commands/settings.command.rs`
- `src-tauri/src/commands/ui_schema_command.rs`

**Old response model at `247bdc7^`** (correct pattern):
```rust
pub use tauri_shared::response::{Response, Status};
pub type ResponseModel = Response<Value>;
```

### 2.2 Angular Frontend - ~271 commits

**Angular removal commit**: `005abc5` - "refactor(zenithdb): remove Angular app files"

**Removed Angular surfaces:**
- `src/app/app.config.ts`
- `src/app/app.routes.ts`
- `src/app/entities/entities.connection.config.ts`
- `src/app/entities/entities.error.entity.ts`
- `src/app/features/connections/connection-modal.component.ts`
- `src/app/features/data-table-grid/data-table-grid.component.ts`
- `src/app/features/bulk-operations/bulk-operations.service.ts`
- `src/app/features/column-manager/column-manager.component.ts`
- `src/app/features/export-dialog/export-dialog.component.ts`
- `src/app/features/query(query)/*.ts`
- `src/app/features/schema(schema)/*.ts`
- `src/app/features/rbac(rbac)/*.ts`
- `src/app/core/services/unified-storage.service.ts`

### 2.3 Key Evolution Timeline

```
[Before 247bdc7] → Used tauri_shared::response::Response (CORRECT)
       ↓
[75e3862]       → Introduced local Response wrapper with status: String
       ↓
[247bdc7]       → "fix: ZenithDB Response data-first + delete local wrapper"
                  BUT kept local Response with status: String instead of
                  importing from tauri_shared
       ↓
[Current]        → ZenithDB/src/lib.rs has divergent Response
```

---

## 3. Parity Gaps

### 3.1 Critical: Response Type Divergence

| Aspect | Unifed Pattern (dioxus-shared) | ZenithDB Current |
|--------|-------------------------------|------------------|
| `status` type | `Status` enum | `String` |
| `message` type | `String` (required) | `Option<String>` |
| `data` type | `Option<T>` | `T` (required) |
| Serde rename | `camelCase` | Implicit |
| Constructor methods | `success()`, `created()`, `error()`, etc. | `success()`, `success_with_message()`, `error()` |

### 3.2 Secondary: ConnectionSummary.status

The `ConnectionSummary` struct uses `status: String` which is semantically a connection health string, not a Response status. This is a domain-level string field (e.g., "connected", "disconnected") rather than a Response status, so it may be acceptable depending on semantics.

| File | Field | Type | Assessment |
|------|-------|------|------------|
| `src/domain/entities/connection.rs` | `ConnectionSummary.status` | `String` | Domain field - may be acceptable |
| `src/application/commands/connection_commands.rs` | `ConnectionListItem.status` | `String` | Domain field - may be acceptable |

### 3.3 Schema Version

Current: **1.0.0** (from `schemas/zenithdb.json` line 4)
- No explicit version tracking of schema evolution
- Schema pages: connections-page, connection-new-page, connection-detail-page, connection-edit-page, database-detail-page, explorer-page, workbench-page, settings-page

---

## 4. Parity Ledger: Old Surfaces with Status

### 4.1 Commands (82 Rust files across commits)

| Command Area | Files | Status Pattern Used |
|--------------|-------|-------------------|
| CRUD | `crud.macro.rs` | `Response<Value>` via `tauri_shared` (historical) |
| Database | `database.command.rs` | `Response<Value>` via `tauri_shared` (historical) |
| Query | `query.command.rs` | `Response<Value>` via `tauri_shared` (historical) |
| RBAC | `rbac.command.rs` | `Response<Value>` via `tauri_shared` (historical) |
| Schema | `schema.command.rs` | `Response<Value>` via `tauri_shared` (historical) |
| Settings | `settings.command.rs` | `Response<Value>` via `tauri_shared` (historical) |
| UI Schema | `ui_schema_command.rs` | `Response<Value>` via `tauri_shared` (historical) |

### 4.2 Services (Historical via tauri_shared)

| Service | Historical Pattern | Current Status |
|---------|-------------------|----------------|
| `connection.service.rs` | `Response<Value>` via `tauri_shared` | Local Response |
| `cloud_sync.service.rs` | `Response<Value>` via `tauri_shared` | Local Response |
| `sync_service.rs` | `Response<Value>` via `tauri_shared` | Local Response |
| `unified-storage.service.ts` | TypeScript Response | Removed (Angular) |

### 4.3 Current Rust Source Files Using Local Response

| File | Response Usage | Notes |
|------|---------------|-------|
| `src/lib.rs` | Defines local `Response<T>` | **PRIMARY DIVERGENCE** |
| `src/application/commands/connection_commands.rs` | Uses `crate::Response` | Propagates divergence |
| `src/application/database_service.rs` | Likely uses local Response | Needs audit |
| `src/application/connection_service.rs` | Likely uses local Response | Needs audit |
| `src/application/query_service.rs` | Likely uses local Response | Needs audit |

### 4.4 Angular Frontend (Removed)

All Angular surfaces using `Response` type from `@tauri-front/shared` were removed in commit `005abc5`.

| Surface Type | Count | Status |
|-------------|-------|--------|
| Page components | ~15 | Removed |
| Feature components | ~25 | Removed |
| Services | ~10 | Removed |
| Entities/Models | ~8 | Removed |

---

## 5. Legacy Data Migration Plan

### 5.1 Response Type Migration

**Step 1: Remove Local Response Definition**
```
File: ZenithDB/src/lib.rs
Action: Remove lines 30-80 (local Response definition)
```

**Step 2: Import Unified Response**
```rust
// Add to top of lib.rs or relevant module
pub use dioxus_shared::response::{Response, Status};
```

**Step 3: Update All Response Usages**

| File | Change Required |
|------|----------------|
| `src/application/commands/connection_commands.rs` | Change `result.status` to use `Status` enum; `Response` re-export from `dioxus_shared` |
| `src/application/commands/database_commands.rs` | Update to use unified `Response` |
| `src/application/commands/query_commands.rs` | Update to use unified `Response` |
| `src/application/connection_service.rs` | Update return types to `Response<T>` |
| `src/application/database_service.rs` | Update return types to `Response<T>` |
| `src/application/query_service.rs` | Update return types to `Response<T>` |

**Step 4: Fix Constructor Calls**

| Old Pattern | New Pattern |
|-------------|-------------|
| `Response { status: result.status, ... }` | Direct field mapping from old `Status::` variants |
| `Response::success(data)` | `Response::success(data, None)` |
| `Response::success_with_message(data, msg)` | `Response::success(data, Some(msg))` |
| `Response::error(msg)` where T: Default | `Response::error(msg)` |

### 5.2 ConnectionSummary.status Field

If `ConnectionSummary.status` is a domain string (e.g., "connected"/"disconnected"), it should be renamed to `connection_status` or similar to avoid confusion with Response status.

```rust
// In src/domain/entities/connection.rs
pub struct ConnectionSummary {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub connection_status: String,  // Rename from 'status'
}
```

### 5.3 Data Migration Considerations

- No actual data migration needed - the change is code-level
- The `status: String` was never serialized to disk as a proper enum
- Existing connections stored in storage should continue to work

### 5.4 Verification Checklist

- [ ] `cargo check` passes after Response changes
- [ ] All `Response` types import from `dioxus_shared`
- [ ] All `Status` variants use proper enum (`Status::Success`, `Status::Error`, etc.)
- [ ] `message` field is `String` not `Option<String>`
- [ ] `data` field is `Option<T>` not `T`
- [ ] Schema-driven UI handlers properly handle `Option<T>` data

---

## 6. Summary

| Category | Status | Items |
|---------|--------|-------|
| Response type | ❌ DIVERGENT | Uses `String` instead of `Status` enum |
| Message field | ⚠️ DIFFERS | Uses `Option<String>` instead of `String` |
| Data field | ⚠️ DIFFERS | Uses `T` instead of `Option<T>` |
| Schema version | ⚠️ OLD | v1.0.0, no migration tracking |
| Old surfaces | ✅ MIGRATED | Angular removed, Tauri commands refactored |
| Legacy data | ✅ CLEAN | No data migration needed |

---

## 7. References

- Unified Response: `dioxus-shared/src/response.rs` (Status enum + Response struct)
- Current ZenithDB Response: `ZenithDB/src/lib.rs` (divergent local version)
- Historical Response: Git commit `247bdc7^` (correct pattern via tauri_shared)
- Schema: `ZenithDB/schemas/zenithdb.json` v1.0.0
