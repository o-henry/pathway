# ExecPlan: Workflow Safe Preview And Local Stub Mode

## Goal

Make the Tauri workflow tab usable on first run by reserving a real titlebar-safe zone, showing a demo graph when no live graph exists, and removing the default Ollama dependency from the local development path.

## Context

- `src-tauri/tauri.conf.json` keeps macOS overlay titlebar chrome hidden.
- `apps/desktop/src/app/MainAppImpl.tsx` owns the workflow tab state and empty/live graph transitions.
- `apps/desktop/src/lib/exampleGraphBundle.ts` already contains a reusable demo graph.
- `apps/api` generation and revision flows currently depend on an embedding provider and an LLM provider.

## Non-goals

- Full Codex CLI orchestration.
- Production-grade model routing.
- Final chunk-splitting or bundle-size optimization.

## Files to read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/PATHWAY_REFRAME.md
- docs/DESIGN_RESEARCH_PLAYBOOK.md
- docs/IMPLEMENTATION_PLAN.md
- docs/ARCHITECTURE.md
- docs/DYNAMIC_GRAPH_SPEC.md
- docs/RAG_AND_CRAWLING_SPEC.md
- docs/SECURITY_CHECKLIST.md
- docs/phases/phase-08-quality-export-packaging.md
- docs/state/CURRENT_STATE.md

## Planned changes

1. Add a deterministic local stub provider path for graph generation/revision and a deterministic local embedding fallback.
2. Surface the demo graph in the desktop workflow tab whenever no live graph exists yet.
3. Add real top spacing for the hidden titlebar region and expose lightweight status guidance inside the canvas overlay.
4. Update `.env.example`, `README.md`, and state docs to reflect the new default local run path.

## Validation

Commands to run:

```bash
pnpm --filter desktop build
UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_map_generation.py apps/api/tests/test_revisions.py apps/api/tests/test_api_crud.py
UV_CACHE_DIR=.uv-cache uv run pre-commit run gitleaks --all-files
```

Expected results:

- Desktop build succeeds.
- Core API generation/revision tests pass.
- Secret scan passes.

## Risks

- The stub graph path may temporarily mask missing real-model wiring if the docs are unclear.
- The desktop bundle is still large, so startup speed may still need a later optimization pass.

## Rollback

- Revert the stub provider/default env changes and return `LIFEMAP_LLM_PROVIDER` to `ollama`.
- Revert the workflow fallback so the tab returns to the current empty-state-only behavior.

## Completion notes

- Completed:
- Tests run:
- Known gaps:
