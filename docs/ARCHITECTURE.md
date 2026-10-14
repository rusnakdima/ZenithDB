# ZenithDB — Architecture

## Overview

ZenithDB is a Dioxus Desktop application providing database management and query interface. It follows DDD with domain entities for database objects, application services for query orchestration, and infrastructure for persistence.

## Module Map

```
ZenithDB/src/
├── domain/           # Database entities, query models, schema definitions
├── application/      # Query service, database service, KAS handlers
├── infrastructure/   # Storage, query engine, bridge
├── presentation/     # Dioxus UI pages and components
├── verification/     # Schema validation and query tests
├── global_state.rs   # Global signals
├── bridge.rs        # MCP bridge entry point (private)
├── app.rs           # App entry point, route definitions
└── lib.rs           # Library root with public re-exports
```

## Domain Layer (`domain/`)

Pure database logic:
- **Entities**: Database, Table, Column, Index, View
- **Query Models**: Query, QueryResult, QueryPlan
- **Value Objects**: DataType, Constraint, IndexType
- **Domain Services**: Schema validation, query parsing

## Application Layer (`application/`)

Database orchestration:
- **Query Service**: Query execution, result formatting
- **Database Service**: Database CRUD operations
- **Command/Query Handlers**: KAS handlers for bridge commands
- **DTOs**: Query request/response objects
- **Error Types**: `Response<T>` wrapper (re-exported from `dioxus_shared`)

## Infrastructure Layer (`infrastructure/`)

External integrations:
- **Storage**: Database file persistence
- **Query Engine**: Query parsing and execution
- **Bridge**: MCP bridge for desktop communication

## Presentation Layer (`presentation/`)

Dioxus UI:
- **Pages**: Query editor, table browser, schema viewer, settings
- **Components**: SQL editor, result table, schema tree
- **Theming**: Dark theme suitable for database work

## Public API

`lib.rs` exposes:
```rust
pub use app::run;
pub use app::{AppState, Route};
pub use bridge::start_mcp_bridge;
pub use dioxus_shared::Response;
```

## AppState and Routing

`AppState` manages application-wide state. `Route` enum defines navigation routes.

## Bridge (Private)

`bridge.rs` is `mod` (private) — external consumers use the public `start_mcp_bridge` re-export.

## Verification

`verification/` module provides schema validation and query tests.

## Platform

Desktop-only application.
