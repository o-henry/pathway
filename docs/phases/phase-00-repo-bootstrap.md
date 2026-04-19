# Phase 0 — Repository Bootstrap and Guardrails

## Goal

Create a safe, runnable monorepo skeleton for the local Life Map app.

## Non-goals

- No graph generation.
- No RAG.
- No database schema beyond simple health/config stubs.
- No crawling.

## Deliverables

1. Root config:
   - `package.json`
   - `pnpm-workspace.yaml`
   - `pyproject.toml`
   - `.env.example`
   - `.gitignore`
   - `.pre-commit-config.yaml`
   - `gitleaks.toml`
2. Frontend:
   - SvelteKit app under `apps/web`
   - TypeScript enabled
   - basic landing page
   - basic test setup
3. Backend:
   - FastAPI app under `apps/api`
   - `GET /health`
   - config module using environment variables
   - basic pytest setup
4. Documentation:
   - README commands updated
   - `docs/state/CURRENT_STATE.md` updated

## Suggested commands

Use current package versions from official scaffolding tools where possible.
Do not paste any real keys.

Expected future commands:

```bash
pnpm install
pnpm --filter web dev
uv sync
uv run fastapi dev apps/api/lifemap_api/main.py
uv run pytest
pnpm test
pre-commit run --all-files
gitleaks detect --source .
```

## Acceptance criteria

- Frontend starts and shows a landing page.
- Backend starts and returns health status.
- Test commands exist even if minimal.
- `.env` is ignored.
- `data/` private runtime files are ignored.
- `docs/state/CURRENT_STATE.md` is updated.
