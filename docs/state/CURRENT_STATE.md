# Current State

## Status

Phase 8 quality, export, and packaging preparation is complete, and a first workspace history browser is now landed on top.

## Last completed phase

Phase 8 — Quality, Export, and Packaging.
Post-phase addition — Workspace History Browser.

## Known decisions

- Frontend: SvelteKit + Svelte Flow + Rough.js + ELK.js.
- Backend: FastAPI + SQLite + LanceDB.
- Local AI default: Ollama.
- External OpenAI provider: optional through environment variables only.
- Graph schema: dynamic `GraphBundle` with per-map ontology.
- Source ingestion: manual first; permitted crawling only.
- Export format: `MapExportEnvelope` JSON plus Markdown snapshot export.
- E2E browser path: workspace-local Playwright browser cache.

## Next task

Choose the next product direction rather than the next infrastructure phase. The highest-value options are:

1. Complete real URL ingestion beyond preview-only policy checks.
2. Improve graph engine bundle splitting and runtime performance.
3. Decide desktop packaging flow (`Tauri` sidecar route).
4. Expand the history browser into a full multi-goal workspace with filtering/search.

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
- `pnpm typecheck`
- `pnpm --filter web build`
- `pnpm playwright:install`
- `pnpm test:web:e2e`

## Known gaps

- No remote URL content fetcher yet; only policy preview exists.
- The graph engine client chunk is still large.
- Frontend runtime schema validation is still deferred; backend remains the source of truth for bundle validation.
- The workspace history browser exists, but it is still anchored to the landing page rather than a dedicated multi-pane workspace.
- Production deployment/runtime adapter for SvelteKit is still undecided.
- Tauri packaging is documented but not implemented.
- Automated crawling rate limiting is not implemented because remote fetching itself is intentionally deferred.

## Changed files

- Root workspace/config:
  - `package.json`
  - `pnpm-workspace.yaml`
  - `pyproject.toml`
  - `.gitignore`
  - `README.md`
- Backend domain/persistence/API:
  - `apps/api/lifemap_api/domain/*`
  - `apps/api/lifemap_api/application/*`
  - `apps/api/lifemap_api/infrastructure/*`
  - `apps/api/lifemap_api/api/*`
  - `apps/api/lifemap_api/main.py`
  - `apps/api/tests/*`
- Frontend workspace:
  - `apps/web/package.json`
  - `apps/web/playwright.config.ts`
  - `apps/web/vite.config.ts`
  - `apps/web/src/routes/+page.svelte`
  - `apps/web/src/lib/api/client.ts`
  - `apps/web/src/lib/components/*`
  - `apps/web/src/lib/components/WorkspaceHistoryPanel.svelte`
  - `apps/web/src/lib/components/lifemap/*`
  - `apps/web/src/lib/fixtures/exampleGraphBundle.ts`
  - `apps/web/src/lib/graph/*`
  - `apps/web/e2e/smoke.spec.ts`
- Planning / state:
  - `docs/SECURITY_CHECKLIST.md`
  - `docs/TAURI_PACKAGING_NOTE.md`
  - `docs/state/EXECPLAN_PHASE_00.md`
  - `docs/state/EXECPLAN_PHASE_01.md`
  - `docs/state/EXECPLAN_PHASE_02.md`
  - `docs/state/EXECPLAN_PHASE_03.md`
  - `docs/state/EXECPLAN_PHASE_04.md`
  - `docs/state/EXECPLAN_PHASE_05.md`
  - `docs/state/EXECPLAN_PHASE_06.md`
  - `docs/state/EXECPLAN_PHASE_07.md`
  - `docs/state/EXECPLAN_PHASE_08.md`
  - `docs/state/CURRENT_STATE.md`
