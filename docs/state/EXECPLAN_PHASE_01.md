# ExecPlan: Phase 1 Backend Domain and Persistence

## Goal

Implement the backend domain models, SQLite persistence layer, repository
interfaces, and CRUD APIs for profiles, goals, maps, manual sources, and
check-ins.

## Context

- Phase 0 already established the workspace, FastAPI app, and `/health`.
- Phase 1 is limited to persistence and CRUD. No LLM, RAG, or graph rendering.
- The API should stay local-first and keep graph snapshots as JSON without
  prematurely hardcoding a global graph schema.

## Non-goals

- No graph generation
- No retrieval layer
- No frontend graph UI work
- No crawling or source fetching

## Files to read

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DYNAMIC_GRAPH_SPEC.md`
- `docs/phases/phase-01-backend-domain-persistence.md`
- `docs/state/CURRENT_STATE.md`

## Planned changes

1. Add pure domain models and repository protocols.
2. Add SQLModel-based SQLite records, engine/session management, and repository implementations.
3. Add application services and CRUD routers for profiles, goals, maps, sources, and check-ins.
4. Add domain, repository, and API CRUD tests.

## Validation

Commands to run:

```bash
UV_CACHE_DIR=.uv-cache uv sync
UV_CACHE_DIR=.uv-cache uv run ruff check apps/api
UV_CACHE_DIR=.uv-cache uv run pytest
UV_CACHE_DIR=.uv-cache pnpm test
pnpm typecheck
```

Expected results:

- SQLite-backed CRUD flow works end-to-end.
- Lint and tests pass.
- Root test/typecheck commands still work.

## Risks

- Overusing framework types in the domain layer would make later phases brittle.
- Premature graph-schema constraints would undermine the dynamic ontology goal.

## Rollback

- Remove the newly added backend domain/application/infrastructure/api modules.
- Restore `main.py` to the Phase 0 `/health`-only version.

## Completion notes

- Completed:
  - Domain models for profile, goal, map, source, chunk, check-in, decision
  - SQLModel records and SQLite engine/session bootstrap
  - Repository interfaces and SQLite repository implementations
  - CRUD routers for profile, goals, maps, sources, and check-ins
  - Domain/repository/API tests for the Phase 1 acceptance criteria
- Tests run:
  - `UV_CACHE_DIR=.uv-cache uv run ruff check apps/api`
  - `UV_CACHE_DIR=.uv-cache uv run pytest`
  - `UV_CACHE_DIR=.uv-cache pnpm test`
  - `pnpm typecheck`
- Known gaps:
  - No dynamic GraphBundle validation yet
  - No graph UI integration yet
  - No source chunk creation or retrieval path yet
