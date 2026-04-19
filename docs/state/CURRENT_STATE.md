# Current State

## Status

Phase 5 source library and local retrieval is complete.

## Last completed phase

Phase 5 — Source Library and Local RAG.

## Known decisions

- Frontend: SvelteKit + Svelte Flow + Rough.js + ELK.js.
- Backend: FastAPI + SQLite + LanceDB.
- Local AI default: Ollama.
- External OpenAI provider: optional through environment variables only.
- Graph schema: dynamic `GraphBundle` with per-map ontology.
- Source ingestion: manual first; permitted crawling only.

## Next task

Execute `docs/phases/phase-06-rag-grounded-generation.md`.

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
- `UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_graph_bundle_validation.py apps/api/tests/test_api_crud.py apps/api/tests/test_repositories.py`
- `UV_CACHE_DIR=.uv-cache uv sync`
- `pnpm --filter web build`
- `UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_source_library.py`

## Known gaps

- No RAG-grounded graph generation yet.
- No remote URL content fetcher yet.
- Playwright browsers were not downloaded or executed.
- The frontend static demo bundle is rendered eagerly; chunk splitting/perf tuning is deferred.
- Frontend runtime schema validation is still deferred; backend remains the source of truth for bundle validation.
- Semantic provenance checks for “claim must have evidence or assumption” are not yet modeled beyond structural refs.
- The generation panel is currently a landing-page bootstrap flow, not a full workspace.
- Production deployment/runtime adapter for SvelteKit is still undecided.

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
- Backend graph validation:
  - `apps/api/lifemap_api/domain/graph_bundle.py`
  - `apps/api/tests/graph_bundle_fixture.py`
  - `apps/api/tests/test_graph_bundle_validation.py`
- Backend LLM generation:
  - `apps/api/lifemap_api/infrastructure/llm_providers.py`
  - `apps/api/lifemap_api/application/generation.py`
  - `apps/api/tests/test_map_generation.py`
- Backend source library and retrieval:
  - `apps/api/lifemap_api/application/source_pipeline.py`
  - `apps/api/lifemap_api/application/sources.py`
  - `apps/api/lifemap_api/infrastructure/embeddings.py`
  - `apps/api/lifemap_api/infrastructure/vector_store.py`
  - `apps/api/tests/test_source_library.py`
- Frontend generation bootstrap:
  - `apps/web/src/lib/components/GenerateMapPanel.svelte`
  - `apps/web/src/lib/components/SourceLibraryPanel.svelte`
  - `apps/web/src/lib/components/lifemap/StaticLifeMap.svelte`
  - `apps/web/src/routes/+page.svelte`
- Planning state:
  - `docs/state/EXECPLAN_PHASE_00.md`
  - `docs/state/EXECPLAN_PHASE_01.md`
  - `docs/state/EXECPLAN_PHASE_02.md`
  - `docs/state/EXECPLAN_PHASE_03.md`
  - `docs/state/EXECPLAN_PHASE_04.md`
  - `docs/state/EXECPLAN_PHASE_05.md`
  - `docs/state/CURRENT_STATE.md`
