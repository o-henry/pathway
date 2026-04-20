# Current State

## Status

Phase 8 quality, export, and packaging preparation remains complete.
On top of that baseline, the first `Pathway` v-next foundation pass is now landed: goal analysis, current-state snapshots, append-only state updates, route selection, and revision-preview flows are implemented end-to-end.
The repo now contains a Tauri desktop shell under `src-tauri/` and a new `apps/desktop` React frontend.
That desktop frontend has moved past the earlier partial shell transplant: it now uses a full upstream `o-rail` frontend snapshot as the baseline, and the Pathway goal / graph / update workspace has been reattached as the current `MainAppImpl` on top of that baseline.
The latest hardening pass also removed extra `/health` metadata exposure, tightened local host handling for the API, and replaced the desktop app's `null` Tauri CSP with an explicit loopback-friendly policy.
The latest UI refinement pass also retuned the desktop workflow tab toward a cleaner reference-driven branch map: Pathway now renders in a reduced-chrome presentation mode with compact branch chips, softer connectors, a lighter plotting-surface canvas, and tighter Pathway-specific layout spacing.
The latest desktop refocus pass now makes that desktop runtime the default local Pathway surface again: `pnpm dev` opens Tauri, Tauri starts the desktop UI plus API services, and the workflow tab has been rebuilt into a graph-dominant stage with overlay controls instead of a two-column dashboard.
That same pass also pulled more of the intended product loop into the workflow tab itself: the canvas now sits alongside a compact Pathway loop dock, a persistent agent request lane for reality-driven graph updates, and a slide-over inspector that no longer steals permanent width from the map.
The current cleanup pass removes more client-side fabrication from the desktop workflow surface: the workflow canvas no longer falls back to a hardcoded example graph, workflow rail cards only render when backend data exists, inspector visibility is selection-driven, and the visualize/settings tabs now hide or replace UI that previously exposed client-authored placeholder content.
The latest refinement pass also recenters the workflow screen around the canvas itself: side rails were narrowed, the empty graph state was made more canvas-like, Korean is now the default UI locale again, workflow/menu actions were translated, and the desktop font direction is now explicitly Korean-first for Hangul with DM Mono retained for Latin text.
The newest workflow-preview pass now exposes backend revision proposals directly inside the graph canvas: a reality update can generate a preview, added routes show in green, weakened or edited paths show in amber, removed or invalidated paths render with violet dashed/X treatments, and the user can apply or dismiss that preview before replacing the active map.
The latest workflow interaction pass also removes the misplaced header-level rail toggle from the Pathway surface: branch visibility is now controlled inside the graph itself, and pathway nodes can collapse or expand their downstream descendants without shrinking the whole workspace into a dashboard control pattern.
The latest shell polish pass also normalizes the desktop app identity to uppercase `PATHWAY`, so Dock, Cmd+Tab, and bundle-facing app naming can stay consistent with the product mark.
The newest workflow control pass removes the remaining text-button toolbar from the workflow header: graph status is now grouped into a compact in-canvas status strip, and inspector / analyze / generate actions now live as icon controls inside the canvas overlay instead of competing with the graph from above.
That same pass also replaces the broken placeholder icon downloads with real SVG assets sourced from SVGrepo, so the overlay controls no longer depend on fake or malformed files.
The latest node polish pass also hardens the graph card styling: pathway node chips now use a `2px` corner radius, and the root goal node no longer forces white text on a pale surface.
The latest security hygiene pass also confirmed that no real API keys or bearer tokens are tracked in the repo, ran the configured gitleaks hook successfully, and tightened local cleanup by ignoring ad-hoc `pathway-*.png` screenshot artifacts.
The latest safe-preview pass now makes first-run inspection workable again: the Tauri shell reserves actual breathing room under the hidden titlebar, the workflow tab falls back to a visible demo graph instead of a blank empty panel, and the local API defaults to deterministic stub generation/revision plus deterministic local embeddings so Ollama is no longer required for the default dev path.

## Last completed phase

Phase 8 — Quality, Export, and Packaging.
Post-phase addition — Workspace History Browser.
Current additive objective — RAIL UI Pivot for Pathway Desktop.

## Known decisions

- Frontend: SvelteKit + Svelte Flow + Rough.js + ELK.js.
- Backend: FastAPI + SQLite + LanceDB.
- Local AI default: deterministic stub provider until a real Codex CLI path lands.
- External OpenAI provider: optional through environment variables only.
- Graph schema: dynamic `GraphBundle` with per-map ontology.
- Source ingestion: manual first; permitted crawling only.
- Export format: `MapExportEnvelope` JSON plus Markdown snapshot export.
- E2E browser path: workspace-local Playwright browser cache.

## Next task

The highest-value follow-up options are now:

1. Complete the Tauri runtime bridge: dynamic API port discovery, app-data path resolution, and stronger startup / shutdown handling.
2. Deepen the desktop workflow loop so goal intake, agent follow-up questions, route detail, and graph revision previews feel like one continuous Pathway experience rather than separate tabs.
3. Decide and implement the production packaging story for the Python backend so desktop packaging is cleanly supported.
4. Continue graph interaction polish: improve the new per-node branch collapse UX, add richer node evidence affordances, route compare states, and clearer struck/disabled branch visuals when reality invalidates prior paths.
5. Deepen the revision-preview UX so the request lane can compare multiple proposals, show route-level before/after detail, and surface preview rationale without crowding the canvas.
6. Verify the current Korean-first workflow presentation in a live Tauri run and keep trimming any remaining English copy that still leaks through the Pathway-specific surface.
7. Replace the deterministic stub provider with the intended Codex CLI orchestration path once that contract is defined.

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
- `CI=true pnpm install --no-frozen-lockfile`
- `pnpm --filter desktop exec tsc --noEmit`
- `pnpm --filter desktop build`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `pnpm exec tsc --noEmit -p apps/desktop/tsconfig.json`
- `rg -n "pathway-branch-chip|data-pathway-depth=\"0\"|--branch-text" apps/desktop/src/pathway.css apps/desktop/src/app/main/presentation/WorkflowCanvasNodesLayer.tsx`
- `rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' --glob '!apps/web/.playwright-browsers/**' --glob '!src-tauri/target/**' --glob '!.venv/**' --glob '!.pnpm-store/**' --glob '!dist/**' --glob '!build/**' '(OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|API_KEY|SECRET_KEY|ACCESS_TOKEN|REFRESH_TOKEN|PRIVATE KEY|BEGIN RSA|BEGIN OPENSSH|client_secret|authorization:|Bearer |sk-[A-Za-z0-9]|ghp_[A-Za-z0-9]|xox[baprs]-|AKIA[0-9A-Z]{16})' .`
- `find . -maxdepth 3 \\( -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name '*.key' -o -name '*.crt' \\) | sort`
- `git ls-files | rg '(^|/)(\\.env(\\..*)?|.*\\.(pem|key|crt)|data/|logs/)'`
- `UV_CACHE_DIR=.uv-cache uv run pre-commit run gitleaks --all-files`
- `pnpm exec tsc --noEmit -p apps/desktop/tsconfig.json`
- `git diff -- apps/desktop/src/app/MainAppImpl.tsx apps/desktop/src/app/PathwayRailCanvas.tsx apps/desktop/src/app/main/presentation/WorkflowCanvasPane.tsx apps/desktop/src/app/main/presentation/WorkflowCanvasNodesLayer.tsx apps/desktop/src/app/main/presentation/MainAppShell.tsx apps/desktop/src/pathway.css`
- `pnpm exec tsc --noEmit -p apps/desktop/tsconfig.json`
- `git diff -- apps/desktop/src/app/MainAppImpl.tsx apps/desktop/src/i18n/index.tsx apps/desktop/src/i18n/messages/ko.ts apps/desktop/src/pathway.css apps/desktop/src/styles/tokens/theme.css`
- `git diff -- src-tauri/tauri.conf.json src-tauri/Cargo.toml`
- `rg -n "인스펙터|입력 분석|루트 생성|canvas-overlay-pathway|canvas-zoom-controls|workflow-toolbar" apps/desktop/src/app/MainAppImpl.tsx apps/desktop/src/app/PathwayRailCanvas.tsx apps/desktop/src/app/main/presentation/WorkflowCanvasPane.tsx apps/desktop/src/pathway.css`
- `curl -I https://www.svgrepo.com/show/438013/sidebar-right.svg`
- `curl -I https://www.svgrepo.com/show/231056/eye.svg`
- `curl -I https://www.svgrepo.com/show/456812/magic-wand-sparkles.svg`
- `curl -I https://www.svgrepo.com/show/360149/branch.svg`
- `curl -sS https://www.svgrepo.com/show/438013/sidebar-right.svg -o apps/desktop/public/icon-sidebar-right.svg`
- `curl -sS https://www.svgrepo.com/show/231056/eye.svg -o apps/desktop/public/icon-eye.svg`
- `curl -sS https://www.svgrepo.com/show/456812/magic-wand-sparkles.svg -o apps/desktop/public/icon-magic-wand.svg`
- `curl -sS -A 'Mozilla/5.0' https://www.svgrepo.com/show/360149/branch.svg -o apps/desktop/public/icon-branch.svg`
- `pnpm exec tsc --noEmit -p apps/desktop/tsconfig.json`
- `pnpm --filter desktop dev`
- `UV_CACHE_DIR=.uv-cache uv run fastapi dev apps/api/lifemap_api/main.py --host 127.0.0.1 --port 8000`
- `curl -sS http://127.0.0.1:1420/`
- `curl -sS http://127.0.0.1:8000/health`
- `python3 -m http.server 4173`
- `curl -sS http://127.0.0.1:4173/`
- `UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_health.py apps/api/tests/test_api_crud.py`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `git clone --depth=1 https://github.com/o-henry/o-rail /tmp/o-rail-pathway-audit`
- `pnpm --filter desktop typecheck`
- `pnpm --filter desktop build`
- `pnpm --filter desktop exec tsc --noEmit`
- `pnpm --filter desktop build`
- `pnpm --filter web check`
- `pnpm --filter web build`
- `lsof -iTCP:5173 -sTCP:LISTEN -n -P`
- `lsof -iTCP:8000 -sTCP:LISTEN -n -P`
- `pnpm dev`
- `pnpm --filter web check`
- `pnpm --filter web build`
- `pnpm exec node -e "const pkg=require('./package.json'); console.log(pkg.scripts.dev); console.log(pkg.scripts['dev:desktop:full']);"`
- `pnpm --filter web check`
- `pnpm --filter web build`
- `pnpm --filter desktop exec tsc --noEmit`
- `pnpm --filter desktop build`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `pnpm --filter desktop build`
- `UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_map_generation.py apps/api/tests/test_revisions.py apps/api/tests/test_api_crud.py`
- `UV_CACHE_DIR=.uv-cache uv run pre-commit run gitleaks --all-files`

## Known gaps

- No remote URL content fetcher yet; only policy preview exists.
- Goal analysis currently uses deterministic bootstrap logic rather than full model-assisted multi-agent intake.
- The previous complaint was correct: the earlier desktop pass only copied RAIL shell assets and not the real workspace runtime.
- `apps/desktop` now contains the upstream RAIL frontend baseline, and `src/app/MainAppImpl.tsx` has been switched back to the Pathway goal/map/update workflow so the desktop app shows Pathway behavior again.
- The earlier custom Pathway desktop implementation is preserved as a local reference snapshot in `apps/desktop/pathway_snapshot/`.
- The Pathway workflow tab now runs on the original RAIL workflow canvas runtime through a compatibility adapter, and select/drag interaction has been restored.
- The Pathway workflow tab now also has a reduced-chrome presentation mode for the read-only decision map, but long real-world labels may still need smarter measurement or multi-line handling.
- The workflow tab is now much closer to the intended canvas-first decision surface, but the next pass still needs stronger struck/disabled branch rendering for invalidated routes and richer milestone/detail treatment for a selected route.
- The workflow tab now surfaces revision-preview diffs in-canvas, but proposal history, multi-preview compare, and route-level before/after explanation are still missing.
- The workflow tab now supports branch-level collapse/expand from graph nodes, but that interaction still needs a live visual QA pass inside Tauri to confirm the toggle affordance and descendant reflow feel fully natural on dense maps.
- The workflow tab header controls are now in-canvas overlays, but they still need a live Tauri screenshot pass to tune collision behavior against dense nodes near the upper-left corner.
- The desktop request lane is still backed by the existing `state update` API, so the deeper agent-led follow-up question flow is only partially surfaced at the UI level.
- `pnpm dev` is desktop-first again, but the API still emits noisy local Arrow CPU capability warnings in this sandboxed environment even when startup succeeds.
- Interaction cost should now be lower for small-to-medium graphs, but bundle size and very-large-graph rendering still want a dedicated optimization pass.
- The Tauri CSP is still intentionally permissive for the current desktop/dev bridge (`unsafe-inline` / `unsafe-eval`); there is no key leakage, but this should get a dedicated runtime hardening pass before any broader distribution build.
- The default local run path is now desktop-first (`pnpm dev`), but some older docs and state notes may still mention the previous web-first detour for historical context.
- The desktop shell exists, but production backend bundling is not solved yet; current startup assumes a local `uv`-based development environment.
- Legacy `maps` / `checkins` terminology still exists internally and on compatibility routes.
- Playwright e2e execution is blocked in this environment because Chromium launch is denied by the sandbox.
- The React desktop bundle is relatively large for an initial shell pass and has not been chunk-optimized yet.
- Frontend runtime schema validation is still deferred; backend remains the source of truth for bundle validation.
- Some unused or secondary components still contain older locale-specific copy and should be cleaned up in a later pass.
- Desktop path resolution still points at the repo layout rather than a Tauri-managed app data directory.
- Automated crawling rate limiting is not implemented because remote fetching itself is intentionally deferred.
- The latest concept-map node skin and clustered left-to-right layout are still deterministic; deeper semantic grouping, revision-aware reflow, and richer edge semantics remain future polish work.
- The latest workflow cleanup removed more client-side placeholders, but the workflow empty state still wants a more deliberately designed pre-graph surface instead of a simple empty card treatment.
- The workflow tab now shows a demo graph when no live map exists, but the actual Codex CLI-backed generation path is still pending; generation and revision use deterministic local stubs by default for now.
- The titlebar collision is now handled with a fixed safe offset, but a future native safe-area measurement pass would be more robust than the current token-based spacing.
- Repository-wide TypeScript validation is still blocked by the existing desktop toolchain / tsconfig mismatch, so current verification relies on targeted code inspection and runtime checks instead of a clean full typecheck.
- Korean is now forced as the default desktop locale on startup, which matches the current product direction but intentionally ignores a previously saved non-Korean locale until a later locale-preference pass revisits that behavior.

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
  - `apps/web/src/lib/graph/layout.ts`
  - `apps/web/src/lib/graph/performance.ts`
  - `apps/web/src/lib/graph/types.ts`
  - `apps/web/src/lib/graph/style.ts`
  - `apps/web/src/routes/+page.svelte`
  - `scripts/dev-reset.mjs`
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
- New React desktop frontend:
  - `apps/desktop/package.json`
  - `apps/desktop/tsconfig.json`
  - `apps/desktop/tsconfig.node.json`
  - `apps/desktop/vite.config.ts`
  - `apps/desktop/index.html`
  - `apps/desktop/public/favicon.svg`
  - `apps/desktop/public/fonts/*`
  - `apps/desktop/public/*.svg`
  - `apps/desktop/src/App.tsx`
  - `apps/desktop/src/main.tsx`
- `apps/desktop/src/App.css`
- `apps/desktop/src/pathway.css`
- `apps/desktop/src/app/MainApp.tsx`
- `apps/desktop/src/app/PathwayRailCanvas.tsx`
- `apps/desktop/src/app/main/presentation/WorkflowCanvasPane.tsx`
- `apps/desktop/src/app/main/presentation/WorkflowCanvasNodesLayer.tsx`
- `apps/desktop/src/app/theme/ThemeProvider.tsx`
- `apps/desktop/src/app/themeMode.ts`
- `apps/desktop/src/components/AppNav.tsx`
- `apps/desktop/src/i18n/*`
- `apps/desktop/src/lib/api.ts`
- `apps/desktop/src/lib/types.ts`
- `apps/desktop/src/lib/exampleGraphBundle.ts`
- `apps/desktop/src/app/MainAppImpl.tsx`
- `apps/desktop/src/styles/layout/shell/app-shell.css`
- `apps/desktop/src/styles/tokens/theme.css`
- `.env.example`
- `docs/state/EXECPLAN_WORKFLOW_SAFE_PREVIEW.md`
- `src-tauri/tauri.conf.json`
- `src-tauri/icons/pathway.icns`
- `apps/desktop/pathway_snapshot/*`
- `apps/desktop/src/*`
- `apps/desktop/public/*`
- Backend domain/persistence/API:
  - `apps/api/lifemap_api/main.py`
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
  - `apps/web/src/routes/+layout.ts`
  - `apps/web/src/routes/+page.svelte`
  - `apps/web/src/lib/api/client.ts`
  - `apps/web/src/lib/components/*`
  - `apps/web/src/lib/components/WorkspaceHistoryPanel.svelte`
  - `apps/web/src/lib/components/lifemap/*`
  - `apps/web/src/lib/components/lifemap/GenericMindMapNode.svelte`
  - `apps/web/src/lib/components/lifemap/MindMapEdge.svelte`
  - `apps/web/src/lib/components/lifemap/StaticLifeMap.svelte`
  - `apps/web/src/lib/fixtures/exampleGraphBundle.ts`
  - `apps/web/src/lib/graph/*`
  - `apps/web/src/lib/graph/style.ts`
  - `apps/web/e2e/smoke.spec.ts`
- Desktop refocus:
  - `apps/desktop/src/app/MainAppImpl.tsx`
  - `apps/desktop/src/app/PathwayRailCanvas.tsx`
  - `apps/desktop/src/pathway.css`
  - `scripts/dev-reset.mjs`
  - `package.json`
  - `src-tauri/tauri.conf.json`
  - `README.md`
  - `docs/state/EXECPLAN_DESKTOP_TAURI_REFOCUS.md`
  - `docs/state/CURRENT_STATE.md`
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
  - `docs/state/EXECPLAN_RAIL_UI_PIVOT.md`
  - `docs/state/EXECPLAN_WORKFLOW_TAB_REFERENCE_REFRESH.md`
  - `docs/state/EXECPLAN_WEB_PATHWAY_RAIL_REFRAME.md`
  - `docs/state/CURRENT_STATE.md`
- Desktop shell:
  - `src-tauri/Cargo.toml`
  - `src-tauri/build.rs`
  - `src-tauri/src/main.rs`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/capabilities/default.json`
