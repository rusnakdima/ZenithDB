# ZenithDB — STATUS

> Generated: 2026-09-04
> Audit depth: Deep (full DDD + SDUI review)
> Strategy doc only — no code changes.

## Cargo Check

```
warning: `dioxus-shared` (lib) generated 84 warnings (run `cargo fix --lib -p dioxus-shared` to apply 32 suggestions)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1m 19s
```

Re-run tail (cleaner):
```
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.31s
```

**Result:** PASS

Notes:
- Build emits only warnings from `dioxus-shared` (none from `zenithdb` itself).
- All 84 warnings originate outside this crate (in the shared library).

## Current State

### Stack
- Crate type: lib + bin (`src/lib.rs` + `src/main.rs`)
- Dioxus: `0.8.0-alpha.1` (desktop + html + hooks + signals + macro + lib + router)
- SDUI: no — hardcoded 5-page Dioxus RSX router (connections, new-connection, explorer, workbench, settings)
- Schema: local `schemas/zenithdb.json` (checked at build time; bridge.rs loads it via `include_str!`)
- All rendering via hardcoded `presentation/pages/` RSX components; no `DynamicPage`
- Backend services depend on local crate `nosql_orm` (6 providers: JSON, Mongo, Redis, PostgreSQL, SQLite, MySQL)

### DDD Layer Coverage

| Layer | Path | Status |
|---|---|---|
| domain/entities | `src/domain/entities/` | 4 files (connection, database, collection, query) |
| domain/services | `src/domain/` | MISSING (no dedicated services/ subdir — services live in `application/`) |
| domain/value_objects | `src/domain/` | MISSING (inlined as structs in entities/) |
| domain/events | `src/domain/` | MISSING |
| application/services | `src/application/{connection,database,query}_service.rs` | 3 files |
| application/commands | `src/application/commands/` | 4 files (connection/database/query/screenshot) |
| application/handlers | `src/application/` | MISSING (commands serve as handlers) |
| application/queries | `src/application/` | MISSING (folded into QueryService) |
| infrastructure/repositories | `src/infrastructure/` | 2 files (pool_manager, connection_storage) acting as repository layer |
| infrastructure/storage | `src/infrastructure/` | bundled in connection_storage |
| infrastructure/api | `src/infrastructure/` | MISSING |
| presentation/ | `src/presentation/` | actions.rs only (no UI components — all SDUI) |

Note: ZenithDB uses a slim 3-layer DDD: `domain` → `application` → `infrastructure`. There is no `events`, `value_objects`, or `handlers/` directory — DDD ceremony is intentionally light. Not necessarily wrong, but inconsistent with the canonical 7-layer template.

### Schema Coverage (SDUI apps only)

- Schema file: `dioxus-shared/assets/schemas/zenithdbschemas.json` (symlinked via `ZenithDB/schemas/zenithdb.json`)
- Schema version: `1.0.0` (top-level `version` and `app.version`)
- Pages defined: 2 (`database-browser`, `query-editor`)
- Shortcuts: `[]` (none)
- Modals: `[]` (none) — but `presentation/actions.rs` references `add-connection-modal`, `confirm-delete-modal`, `filter-panel-modal`, `export-menu-modal` via `bus.open_modal(...)` — these modal ids are NOT declared in the schema, so the renderer would have no DOM nodes to mount them on. **P1 bug.**

Distinct component types found in the schema (via `grep -o '"component": "..."'`):
| component | count in schema | resolver arm in `render_component.rs` |
|---|---:|---|
| `button` | many | yes (line 37) |
| `card` | many | yes (line 57) |
| `div` | many | yes (line 58) |
| `header` | 2 | yes (line 64) |
| `textarea` | 1 | yes (line 43) |

Components in schema: **5** unique types
Components with resolver arm: **5** (100% coverage)
Missing resolvers: **none**

### Code Health Counts

- `todo!()`: 0
- `unimplemented!()`: 0
- `panic!`: 0
- `unwrap()`: 0 in `src/` (the build.rs uses `.expect(...)` — fine for build scripts)
- `FIXME`: 0
- `TODO`: 0
- `XXX`/`HACK`: 0
- `dbg!()`: 0
- `#[allow(dead_code)]`: 7 (locations listed below)
- `unsafe`: 0
- `println!` stubs in presentation/actions.rs: 4 (`toggle_history`, `format_sql`, `clear_history`, `export_all_data` — line 189, 192, 222, 225) — **silent no-ops, P2**

`#[allow(dead_code)]` markers (each marks a candidate dead public surface):
- `src/infrastructure/pool_manager.rs:202` — `PoolManager::clear()` — **0 callers in ZenithDB src**
- `src/infrastructure/connection_storage.rs:39` — a method in `ConnectionStorage`
- `src/application/database_service.rs:119` — `rename_database()` — **0 callers; all paths return Err("not implemented")**
- `src/application/database_service.rs:147` — `delete_database()` — **0 callers; always returns Err**
- `src/application/connection_service.rs:42` — `ConnectionService::get_instance()` — used 8× inside connection_commands, **kept**
- `src/application/connection_service.rs:88` — `ConnectionService::test_connection_status()` — **0 callers** (the bridge calls `test_connection`, not `_status`)
- `src/domain/entities/connection.rs:86` — `ProviderType` enum — used in `database_service.rs` (renamedb / deletedb logic) and `query_service.rs:191-193`

`pub fn` / `pub async fn` with 0 callsites in `src/`:
- `PoolManager::clear()` (infrastructure/pool_manager.rs:203)
- `PoolManager::remove()` (infrastructure/pool_manager.rs:194) — declared `pub` but never invoked
- `ConnectionService::test_connection_status()` (application/connection_service.rs:88)
- `DatabaseService::rename_database()` (application/database_service.rs:120)
- `DatabaseService::delete_database()` (application/database_service.rs:148)
- `screenshot_commands::capture_screenshot()`, `capture_linux_screenshot()`, etc. — **entire `screenshot_commands.rs` module has 0 callers** (defined in mod.rs, re-exported, but never invoked from `actions.rs` or `bridge.rs`)

### Response<T> Status Variant Usage

- `Response::success`: 31 (every service-layer success path)
- `Response::created`: 0
- `Response::updated`: 0
- `Response::deleted`: 0
- `Response::error` / `Response::err`: 0
- `Response::validation_error`: 0
- `Response::not_found`: 0
- `Status::*` direct usage: 0 (services only use `Response::success`)
- Bare `String` returns (anti-pattern): all errors return via `Err(format!(...))` instead of `Response::error(...)` → **8 occurrences** across connection_service.rs (1), query_service.rs (4), database_service.rs (3).

#### Critical anti-pattern: errors hidden as `Response::success`

In `src/application/connection_service.rs:122-131` and `162-171`, failed lookups and provider-creation failures are wrapped in `Response::success(ConnectionHealth::err(...), Some("..."))` — meaning **the HTTP-style status is `Success` even when the operation failed**, with the failure encoded only in the `data.healthy = false` flag. The Status enum variant is therefore misleading; downstream consumers must remember to check `data.healthy` rather than `status`. This contradicts the contract defined in `dioxus_shared::response.rs` where `Status::Error` and `Status::NotFound` exist for exactly this purpose.

## Broken / Missing / Incomplete

### P0 — Blocking (breaks cargo check or runtime)
- None. `cargo check` passes.

### P1 — High (silent bugs, schema/resolver mismatch, dead public API)
- **P1.1** `src/presentation/actions.rs:189-225` — modal ids `add-connection-modal`, `confirm-delete-modal`, `filter-panel-modal`, `export-menu-modal` are passed to `bus.open_modal(...)` but the schema declares `"modals": []` (`zenithdbschemas.json:421`). Clicking any of these actions will open no UI. Schema must declare these modals, OR actions must be wired to inline overlay components.
- **P1.2** `src/application/connection_service.rs:122-131,162-171` — `check_health` and `test_connection` failures return `Response::success` with a sentinel `ConnectionHealth::err(...)` payload, not `Response::error` / `Status::Error`. Callers cannot distinguish success from failure via `Status`.
- **P1.3** `src/bridge.rs:357-359` — `invoke_ui_action` is a permanent stub: every UI action dispatched via MCP returns `Err("zenithdb ui action not implemented: …")`. If the schema UI ever dispatches MCP UI actions, they will all fail. Either implement or document as out-of-scope.

### P2 — Medium (code smells, missing layers, missing tests)
- **P2.1** `src/application/database_service.rs:120-145,148-164` — `rename_database` and `delete_database` are public, documented, return `Result<Response<Value>, String>`, and ALWAYS return `Err(...)`. They have zero callers and serve no purpose.
- **P2.2** `src/application/commands/screenshot_commands.rs` — entire 178-line module has zero callers in ZenithDB (and the bridge never registers a `screenshot.*` command). Either wire it to a UI action or delete it.
- **P2.3** `src/infrastructure/pool_manager.rs:194,203` — `PoolManager::remove` and `PoolManager::clear` are `pub` and have zero callers in ZenithDB.
- **P2.4** `src/presentation/actions.rs` — `println!` / `eprintln!` rather than `tracing::info!` / `tracing::warn!`. The project already depends on `tracing` (Cargo.toml line 53) and `log`. Action outcomes should be observable via the existing logger, not stdout.
- **P2.5** `src/presentation/actions.rs:189,192,222,225` — `toggle_history`, `format_sql`, `clear_history`, `export_all_data` are silent no-ops (`println!("...")` only). UI buttons bound to these actions appear to do nothing.
- **P2.6** Domain layer lacks `services/`, `value_objects/`, `events/` subdirs — inconsistent with the canonical DDD template used in other projects. Either consolidate under `application/services` (current state) or split.
- **P2.7** `src/application/connection_service.rs:108-133` `check_health` returns `Result<Response<ConnectionHealth>, String>` where `ConnectionHealth` already carries a `healthy: bool` field. Returning the response with status `Error` when unhealthy would be more idiomatic.

### P3 — Low (style, dead code, archive cleanup)
- **P3.1** `src/main.rs:54-95` `_process_eval_on_main_thread` — leading underscore, elided in this audit but appears unused (suspicious given the rest of the file has it). Verify and remove if dead.
- **P3.2** No `_archive/2026-08-25/` directory found in this project — ZenithDB predates or never received the migration backup. Skip.
- **P3.3** `src/bridge.rs:61` — `name.strip_prefix("zenithdb.").unwrap_or(name)` is a silent fallback rather than a validation error. If a future MCP command is dispatched without the namespace, it will silently match.

## Prioritized Fix Plan

1. **Fix P1.1 — wire modals to schema** — Add 4 modal entries to `zenithdbschemas.json` (`modals` array: `add-connection-modal`, `confirm-delete-modal`, `filter-panel-modal`, `export-menu-modal`) with the corresponding forms/prompts, OR change `actions.rs` to inline-overlays. — `dioxus-shared/assets/schemas/zenithdbschemas.json` & `src/presentation/actions.rs` — UI gates — effort: M
2. **Fix P1.2 — proper Status for failure paths** — Convert `Response::success(ConnectionHealth::err(...), ...)` to `Response::error_with_data(ConnectionHealth::err(...), "...")` (or `Response::error("...")` where appropriate) in `connection_service.rs:122-131,162-171`. Then update `actions.rs:81-86` and `bridge.rs:281-313` to inspect `response.status`. — `src/application/connection_service.rs`, `src/presentation/actions.rs`, `src/bridge.rs` — correctness — effort: S
3. **Fix P1.3 — `invoke_ui_action` stub** — Implement dispatch to `presentation::actions::handle_action` (treats bus state as `Value` payload), or document explicitly in lib.rs that UI actions are not supported over MCP. — `src/bridge.rs:353-359` — clarity — effort: M
4. **Fix P2.1 — delete dead `rename_database` / `delete_database`** — Remove the two functions and their `#[allow(dead_code)]` markers, or implement them via raw SQL if actually needed. — `src/application/database_service.rs:119-164` — dead code — effort: S
5. **Fix P2.2 — decide on screenshot module** — Either wire `screenshot_commands::capture_screenshot` into `bridge.rs` + schema action, or delete the entire `screenshot_commands.rs` and its `mod.rs` entry. — `src/application/commands/screenshot_commands.rs` — dead code — effort: S
6. **Fix P2.3 — delete unused `PoolManager::{remove, clear}`** — Remove or wire to `delete_connection` flow. — `src/infrastructure/pool_manager.rs:194-207` — dead code — effort: S
7. **Fix P2.5 — implement silent no-op actions** — `toggle_history`, `format_sql`, `clear_history`, `export_all_data` need real handlers or removal. — `src/presentation/actions.rs` — UX — effort: M
8. **Fix P2.4 — replace `println!` with `tracing`** — All 14 println/eprintln calls in `actions.rs` should use `tracing::{info!, warn!, error!}`. — `src/presentation/actions.rs` — observability — effort: S
9. **Fix P3.1 — verify `_process_eval_on_main_thread` use** — Read and either wire it into `ActionProcessor` or delete. — `src/main.rs` — cleanup — effort: S
10. **Fix P3.3 — strict MCP command prefix** — Replace `unwrap_or(name)` fallback with explicit error on missing `zenithdb.` prefix in `bridge.rs:61`. — `src/bridge.rs` — clarity — effort: XS

## Verification

Commands a human runs to confirm each fix in the plan:
1. `cargo check --manifest-path /mnt/external/Projects/ZenithDB/Cargo.toml` exits 0 after every change.
2. `cargo run --manifest-path /mnt/external/Projects/ZenithDB/Cargo.toml` — launch app; click "Add Connection" → modal renders (was: no-op); click "Delete" → confirm modal renders (was: no-op).
3. After P1.2: in dev console or test, call `check_health("nonexistent")` — `response.status` should be `"error"` (was: `"success"`).
4. After P1.3: send an MCP UI action — either succeeds with a meaningful result or returns a documented "not implemented" error (was: always error).
5. After P2.4: `RUST_LOG=info cargo run` — action outcomes appear in logs (was: stdout).
6. Schema sanity: `jq '.modals | length' /mnt/external/Projects/dioxus-shared/assets/schemas/zenithdbschemas.json` returns `4` after P1.1.

## Notes

- **ZenithDB does NOT have a `_archive/2026-08-25/` directory.** Either this project was excluded from the migration or it has no obsolete code to preserve.
- The ZenithDB SDUI schema (`zenithdbschemas.json`) is **clean**: every `component` string in the schema (`button`, `card`, `div`, `header`, `textarea`) has a resolver arm in `dioxus-shared/src/ui/render_component.rs`. 100% coverage confirmed by grep.
- ZenithDB's `Response<T>` usage is fundamentally homogeneous: 31 `Response::success` calls, 0 `Status::Created`/`Updated`/`Deleted`/`Error`. The semantic Status variants exist on the enum but never reach the wire — every "failure" path converts to `Err(String)`. This is consistent across the codebase but blocks the audit's preferred `Status::Error` wrapping.
- 7 `#[allow(dead_code)]` markers in src/. 6 of them are attached to genuinely dead code (P2.1, P2.2, P2.3).
- All 4 `ConnectionHealth::err(...)` calls in `connection_service.rs` happen inside `Response::success(...)` wrappers — see P1.2.
- This is the cleanest ZenithDB on the audit roster from a `todo!`/`panic!`/`unimplemented!` standpoint: zero of each. Code quality issues are architectural (status-enum misuse, dead modules), not stub-level.
