# Current State

## Status

Phase 8 quality, export, and packaging preparation remains complete.
On top of that baseline, the first `Pathway` v-next foundation pass is now landed: goal analysis, current-state snapshots, append-only state updates, route selection, and revision-preview flows are implemented end-to-end.
The main workspace has now been pushed further into a desktop-style graph shell: darker app chrome, tighter panel language, a larger central graph board, and generic English copy replacing the earlier decorative and locale-biased examples.

## Last completed phase

Phase 8 — Quality, Export, and Packaging.
Post-phase addition — Workspace History Browser.
Current additive objective — Pathway VNext Foundation.

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

The highest-value follow-up options are now:

1. Add desktop-grade interaction polish to the graph workspace: keyboard shortcuts, resizable panes, and clearer selected-route / warning affordances.
2. Replace deterministic goal analysis bootstrapping with a bounded research-backed intake/orchestration loop.
3. Complete real URL ingestion beyond preview-only policy checks.
4. Improve graph engine bundle splitting and runtime performance.

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
- `UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_api_crud.py apps/api/tests/test_revisions.py apps/api/tests/test_repositories.py`
- `pnpm --filter web check`
- `pnpm --filter web check`
- `pnpm --filter web check`

## Known gaps

- No remote URL content fetcher yet; only policy preview exists.
- Goal analysis currently uses deterministic bootstrap logic rather than full model-assisted multi-agent intake.
- The main workspace is materially more graph-first now, but it still lacks desktop-grade interactions such as pane resizing, keyboard shortcuts, and richer focus states.
- Legacy `maps` / `checkins` terminology still exists internally and on compatibility routes.
- Playwright e2e execution is blocked in this environment because Chromium launch is denied by the sandbox.
- The graph engine client chunk is still large.
- Frontend runtime schema validation is still deferred; backend remains the source of truth for bundle validation.
- Some unused or secondary components still contain older locale-specific copy and should be cleaned up in a later pass.
- Production deployment/runtime adapter for SvelteKit is still undecided.
- Tauri packaging is documented but not implemented.
- Automated crawling rate limiting is not implemented because remote fetching itself is intentionally deferred.

## Changed files

- New Pathway foundation work:
  - `apps/api/lifemap_api/api/dependencies.py`
  - `apps/api/lifemap_api/api/routes_goals.py`
  - `apps/api/lifemap_api/api/routes_pathways.py`
  - `apps/api/lifemap_api/api/routes_revisions.py`
  - `apps/api/lifemap_api/application/goal_analysis.py`
  - `apps/api/lifemap_api/application/generation.py`
  - `apps/api/lifemap_api/application/revisions.py`
  - `apps/api/lifemap_api/application/state.py`
  - `apps/api/lifemap_api/domain/models.py`
  - `apps/api/lifemap_api/domain/ports.py`
  - `apps/api/lifemap_api/infrastructure/db_models.py`
  - `apps/api/lifemap_api/infrastructure/repositories.py`
  - `apps/api/lifemap_api/main.py`
  - `apps/api/tests/test_api_crud.py`
  - `apps/api/tests/test_revisions.py`
  - `apps/web/e2e/smoke.spec.ts`
  - `apps/web/src/lib/api/client.ts`
  - `apps/web/src/lib/components/CheckInRevisionPanel.svelte`
  - `apps/web/src/lib/components/GenerateMapPanel.svelte`
  - `apps/web/src/lib/components/SourceLibraryPanel.svelte`
  - `apps/web/src/lib/components/WorkspaceHistoryPanel.svelte`
  - `apps/web/src/lib/components/WorkspaceDataPanel.svelte`
  - `apps/web/src/lib/components/lifemap/MindMapEdge.svelte`
  - `apps/web/src/lib/components/lifemap/GenericMindMapNode.svelte`
  - `apps/web/src/lib/components/lifemap/NodeDetailDrawer.svelte`
  - `apps/web/src/lib/components/lifemap/StaticLifeMap.svelte`
  - `apps/web/src/lib/fixtures/exampleGraphBundle.ts`
  - `apps/web/src/lib/graph/format.ts`
  - `apps/web/src/lib/graph/types.ts`
  - `apps/web/src/lib/graph/style.ts`
  - `apps/web/src/routes/+page.svelte`
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/IMPLEMENTATION_PLAN.md`
  - `docs/state/EXECPLAN_PATHWAY_VNEXT_FOUNDATION.md`
  - `docs/state/CURRENT_STATE.md`
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
