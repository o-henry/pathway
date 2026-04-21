# ExecPlan: Pathway Edge Naturalization

## Goal

Make Pathway workflow canvas edges connect more naturally by removing overly rigid side assignments and letting the renderer choose anchors based on actual node geometry.

## Context

- Pathway progression edges were being created with explicit `side` values in `PathwayRailCanvas`.
- That prevented `renderEdges` from using its auto-connection heuristics, which made some node connections feel forced and awkward.
- Relevant files are `apps/desktop/src/app/PathwayRailCanvas.tsx` and `docs/state/CURRENT_STATE.md`.

## Non-goals

- Rewriting the whole graph layout algorithm.
- Changing inspector or workflow panel composition.
- Adding new edge styles.

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
- apps/desktop/src/app/PathwayRailCanvas.tsx
- apps/desktop/src/features/workflow/graph-utils/renderEdges.ts

## Planned changes

1. Stop hardcoding source/target edge sides in `PathwayRailCanvas`.
2. Let the canvas edge renderer resolve anchor sides from node geometry and bundled edge direction.
3. Record the fix and validation in `docs/state/CURRENT_STATE.md`.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- Desktop TypeScript checks pass.
- Pathway edges connect with more natural anchor choices and less forced elbow routing.

## Risks

- Some especially dense maps may still need another routing pass later.

## Rollback

- Revert `apps/desktop/src/app/PathwayRailCanvas.tsx`.

## Completion notes

- Completed:
  - Removed explicit per-edge side forcing from `PathwayRailCanvas`.
  - Restored auto anchor-side selection for Pathway progression edges.
  - Recorded the change in `docs/state/CURRENT_STATE.md`.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
- Known gaps:
  - No fresh live screenshot verification was run in this sandboxed turn.
