# Current State

## Status

Phase 2 static Life Map UI is complete.

## Last completed phase

Phase 2 — Static Life Map UI.

## Known decisions

- Frontend: SvelteKit + Svelte Flow + Rough.js + ELK.js.
- Backend: FastAPI + SQLite + LanceDB.
- Local AI default: Ollama.
- External OpenAI provider: optional through environment variables only.
- Graph schema: dynamic `GraphBundle` with per-map ontology.
- Source ingestion: manual first; permitted crawling only.

## Next task

Execute `docs/phases/phase-03-dynamic-graph-schema-validation.md`.

## Commands run

- `git init -b main`
- `git remote add origin https://github.com/o-henry/pathway.git`
- `XDG_CACHE_HOME=/tmp PNPM_HOME=/tmp/pnpm-home pnpm dlx sv create apps/web --template minimal --types ts --add eslint vitest="usages:unit" playwright --no-install --no-download-check`
- `pnpm install`
- `UV_CACHE_DIR=.uv-cache uv sync`
- `pnpm --filter web check`
- `pnpm --filter web test:unit -- --run`
- `UV_CACHE_DIR=.uv-cache uv run pytest`
- `PYTHONPATH=apps/api UV_CACHE_DIR=.uv-cache uv run python -c "from fastapi.testclient import TestClient; from lifemap_api.main import app; print(TestClient(app).get('/health').json()['status'])"`
- `UV_CACHE_DIR=.uv-cache pnpm lint`
- `PRE_COMMIT_HOME=.pre-commit-cache UV_CACHE_DIR=.uv-cache uv run pre-commit run gitleaks --all-files`
- `UV_CACHE_DIR=.uv-cache uv run ruff check apps/api`
- `UV_CACHE_DIR=.uv-cache pnpm test`
- `pnpm typecheck`
- `pnpm --filter web add @xyflow/svelte elkjs roughjs`
- `pnpm --filter web build`

## Known gaps

- No GraphBundle schema validation yet.
- No LLM graph generation yet.
- No RAG or ingestion pipeline yet.
- Playwright browsers were not downloaded or executed.
- The backend stores graph snapshots as raw JSON; graph-schema enforcement is deferred to Phase 3.
- The frontend static demo bundle is rendered eagerly; chunk splitting/perf tuning is deferred.

## Changed files

- Root workspace/config: `package.json`, `pnpm-workspace.yaml`, `pyproject.toml`, `.gitignore`, `README.md`
- Backend domain/persistence/API:
  - `apps/api/lifemap_api/domain/*`
  - `apps/api/lifemap_api/application/*`
  - `apps/api/lifemap_api/infrastructure/*`
  - `apps/api/lifemap_api/api/*`
  - `apps/api/lifemap_api/main.py`
  - `apps/api/tests/*`
- Frontend bootstrap alignment: `apps/web/package.json`, `apps/web/playwright.config.ts`, `apps/web/src/routes/+page.svelte`, `apps/web/src/lib/components/LandingHero.svelte`, `apps/web/src/lib/components/LandingHero.svelte.test.ts`
- Frontend static Life Map UI:
  - `apps/web/src/lib/components/lifemap/*`
  - `apps/web/src/lib/graph/*`
  - `apps/web/src/lib/fixtures/exampleGraphBundle.ts`
  - `apps/web/src/routes/+page.svelte`
- Planning state:
  - `docs/state/EXECPLAN_PHASE_00.md`
  - `docs/state/EXECPLAN_PHASE_01.md`
  - `docs/state/EXECPLAN_PHASE_02.md`
  - `docs/state/CURRENT_STATE.md`
