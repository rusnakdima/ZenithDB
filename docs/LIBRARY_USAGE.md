# ZenithDB — Library Usage

## Adding as a Dependency

```toml
[dependencies]
zenithdb = { path = "../zenith-db" }
```

## Running the Application

```rust
// Binary entry point
fn main() {
    zenithdb::run();
}
```

## Public API

### Re-exports

```rust
// App entry point and routing
pub use zenithdb::{run, AppState, Route};

// Bridge (public via re-export)
pub use zenithdb::start_mcp_bridge;

// Response type from dioxus-shared
pub use zenithdb::Response;
```

### Core Functions

```rust
pub fn run()

pub struct AppState { /* ... */ }
pub enum Route { /* ... */ }
pub fn start_mcp_bridge()
```

## Bridge (Public Re-export)

Unlike most apps where `bridge.rs` is private, ZenithDB re-exports `start_mcp_bridge`:

```rust
pub use bridge::start_mcp_bridge;
```

This allows external consumers to initialize the bridge without accessing the module directly.

## Library Crate Type

```toml
[lib]
name = "zenithdb"
crate-type = ["staticlib", "cdylib", "rlib"]
```

## Shared Dependencies

- `dioxus` / `dioxus-desktop` — UI framework
- `dioxus-shared` — `DynamicPage`, `SignalStore`, `Response`, OAuth, services
- `nosql_orm` — database ORM with SQL support (PostgreSQL, SQLite, MySQL, Redis)
- `dioxus-router` — navigation
- `reqwest` — HTTP client

## Platform

Multi-platform via code generation (`gen/bin/desktop.rs` for desktop, mobile via staticlib/cdylib).
