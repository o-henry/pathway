# Phase 8 Execution Notes

## Goal

Finish the first durable local-only version of Life Map by adding export/import, backup guidance, accessibility improvements, and a real end-to-end validation loop.

## Completed

- Added backend JSON export endpoint for a map snapshot.
- Added backend Markdown export endpoint for a map snapshot.
- Added backend JSON import endpoint that can restore a previously exported snapshot.
- Added API/domain models for `MapExportEnvelope` and `MapImportEnvelope`.
- Added backend CRUD test coverage for export/markdown/import.
- Added frontend `WorkspaceDataPanel` for JSON export, Markdown export, and JSON import.
- Added keyboard-accessible node browser to the graph workspace.
- Lazy-loaded heavy graph/revision/source panels on the landing page to reduce eager initial load.
- Added Playwright workflow coverage for:
  - goal creation path
  - map generation
  - check-in creation
  - revision acceptance
- Added root/browser install script for Playwright browsers.
- Refreshed README with runbook, backup/restore, and export/import instructions.
- Refreshed security checklist.
- Added a Tauri packaging research note.

## Validation run

- `uv run pytest`
- `uv run ruff check apps/api`
- `UV_CACHE_DIR=.uv-cache pnpm lint`
- `pnpm typecheck`
- `pnpm --filter web build`
- `pnpm secret-scan`
- `pnpm test:web:e2e`

## Notes

- Playwright required a workspace-local browser install path and an escalated browser launch in this environment.
- The graph engine bundle is still large; lazy loading is in place, but deeper chunk strategy remains a follow-up optimization rather than a blocker for Phase 8.
