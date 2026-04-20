# ExecPlan: Pathway VNext Foundation

## Goal

Turn the current generate-map/check-in flow into a clearer Pathway foundation with explicit goal analysis, current state snapshots, append-only state updates, route selection, and pathway/revision-preview naming at the API/UI edge.

## Context

- Existing implementation already supports goals, maps, check-ins, and revision proposals.
- User intent has shifted toward a living pathway graph that changes as reality updates accumulate.
- The repo currently exposes `LifeMap`, `CheckIn`, and `RevisionProposal` terminology internally and externally.
- SQLite schema is created through `SQLModel.metadata.create_all`, so additive tables are low-risk.

## Non-goals

- Full visual redesign of every panel and graph affordance.
- Hard rename of all internal `LifeMap` symbols and tables.
- Fully model-driven goal analysis via remote LLM only.
- Destructive migration of existing local data.

## Files to read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/PATHWAY_REFRAME.md
- docs/ARCHITECTURE.md
- docs/DYNAMIC_GRAPH_SPEC.md
- docs/state/CURRENT_STATE.md

## Planned changes

1. Add additive domain/database foundations for goal analysis, current state snapshots, state updates, and route selection.
2. Extend generation/revision flows to include current state and selected route context.
3. Add `/pathways`, `/state-updates`, and related alias endpoints while keeping old endpoints working.
4. Update the web app to use Pathway naming and the new state/revision-preview flow.
5. Refresh docs/state notes and validation coverage.

## Validation

Commands to run:

```bash
UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_api_crud.py apps/api/tests/test_revisions.py apps/api/tests/test_repositories.py
pnpm --filter web test:unit -- --run
pnpm --filter web check
```

Expected results:

- Backend tests cover additive state/pathway routes without regressing old routes.
- Frontend typecheck passes after Pathway naming and API client changes.

## Risks

- Keeping old and new terminology side-by-side can introduce mapping mistakes.
- Existing local SQLite databases will not gain new columns automatically, so compatibility must be additive.
- Revision preview behavior may drift if the graph canvas and dock do not agree on accepted vs preview state.

## Rollback

- Remove new routers and dependencies from `main.py`.
- Delete new additive tables/models and fall back to existing check-in/revision flow.
- Revert web API usage to legacy `/maps` and `/checkins` routes.

## Completion notes

- Completed:
  - additive domain/database support for goal analysis, current state snapshots, state updates, and route selection
  - pathway alias routes and revision-preview routes
  - web client migration to the new state/pathway flow
  - graph overlay highlighting for selected routes and preview deltas
  - first graph-first UI redesign pass with a larger central board, navigator/history moved left, and a simplified analysis console
- Tests run:
  - `UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_api_crud.py apps/api/tests/test_revisions.py apps/api/tests/test_repositories.py`
  - `pnpm --filter web check`
- Known gaps:
  - Playwright e2e browser launch is blocked in the current sandboxed environment
  - internal `LifeMap` and some legacy endpoint names still exist for compatibility
  - goal analysis is deterministic bootstrap logic for now, not yet a full research-driven multi-agent loop
  - the UI is materially more graph-first now, but a deeper visual refinement pass is still needed to fully minimize support-panel dominance
