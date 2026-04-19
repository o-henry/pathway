# ExecPlan: Phase 0 Repository Bootstrap

## Goal

Create a safe, runnable monorepo skeleton for Life Map with a SvelteKit frontend,
a FastAPI backend, root workspace tooling, and the baseline guardrails required
to keep later phases coherent.

## Context

- This repository started from the planning pack and had no implementation.
- `docs/phases/phase-00-repo-bootstrap.md` is the scope boundary.
- `apps/web` was scaffolded with the official Svelte CLI and still needs to be
  aligned with the repo scripts, landing page, and smoke tests.
- Backend, root package manager config, and Python project config do not exist yet.

## Non-goals

- No graph generation.
- No RAG or crawling.
- No database persistence beyond config defaults.
- No dynamic graph schema implementation.

## Files to read

- `AGENTS.md`
- `docs/CODEX_START_HERE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/SECURITY_CHECKLIST.md`
- `docs/phases/phase-00-repo-bootstrap.md`
- `docs/state/CURRENT_STATE.md`

## Planned changes

1. Add root workspace files: `package.json`, `pnpm-workspace.yaml`,
   `pyproject.toml`, runtime dirs, and command wiring.
2. Add the FastAPI app skeleton with env-based config, `/health`, and pytest smoke tests.
3. Align the SvelteKit app with a Life Map landing page and minimal unit/e2e tests.
4. Update `README.md` and `docs/state/CURRENT_STATE.md` after running checks.

## Validation

Commands to run:

```bash
pnpm install
pnpm --filter web check
pnpm --filter web test:unit -- --run
uv sync
uv run pytest
uv run python -c "from fastapi.testclient import TestClient; from lifemap_api.main import app; print(TestClient(app).get('/health').json()['status'])"
```

Expected results:

- Workspace dependencies install cleanly.
- Web type checks and unit tests pass.
- Backend tests pass.
- Health endpoint returns `ok`.

## Risks

- CLI-scaffolded frontend files may include defaults that drift from repo conventions.
- Playwright browser downloads may be heavy for Phase 0, so e2e is scaffolded but not executed unless needed.

## Rollback

- Remove added root workspace files and `apps/api`.
- Restore `apps/web` scaffold files if a patch regresses the default setup.

## Completion notes

- Completed:
  - Root pnpm + uv workspace scaffolding
  - Official SvelteKit app scaffold under `apps/web`
  - FastAPI app skeleton under `apps/api`
  - Root scripts, README commands, and gitignore/security guardrails
  - Minimal web/unit/api smoke tests
- Tests run:
  - `pnpm --filter web check`
  - `pnpm --filter web test:unit -- --run`
  - `UV_CACHE_DIR=.uv-cache uv run pytest`
  - `PYTHONPATH=apps/api UV_CACHE_DIR=.uv-cache uv run python -c "from fastapi.testclient import TestClient; from lifemap_api.main import app; print(TestClient(app).get('/health').json()['status'])"`
  - `UV_CACHE_DIR=.uv-cache pnpm lint`
  - `PRE_COMMIT_HOME=.pre-commit-cache UV_CACHE_DIR=.uv-cache uv run pre-commit run gitleaks --all-files`
- Known gaps:
  - No Playwright browser install/run yet
  - No persistence or domain layer yet
  - No graph generation or RAG yet
