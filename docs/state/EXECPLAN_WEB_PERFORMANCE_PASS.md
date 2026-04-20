# ExecPlan: Web Graph Performance Pass

## Goal

Improve Pathway web responsiveness by removing unnecessary graph recomputation on selection/hover updates and by caching expensive graph preparation/layout work for unchanged bundles.

## Context

- The current web graph surface is visually closer to the intended product direction, but the runtime still recomputes too much work in `StaticLifeMap.svelte`.
- Selection, preview, and route emphasis should not force a fresh layout of the whole board.
- The user explicitly asked for performance optimization.

## Non-goals

- Do not redesign backend APIs.
- Do not change product behavior or graph semantics.
- Do not add premature virtualization for huge graphs before removing obvious recomputation waste.

## Files to read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/PATHWAY_REFRAME.md
- docs/ARCHITECTURE.md
- docs/DYNAMIC_GRAPH_SPEC.md
- docs/state/CURRENT_STATE.md
- apps/web/src/lib/components/lifemap/StaticLifeMap.svelte
- apps/web/src/lib/graph/flow.ts
- apps/web/src/lib/graph/layout.ts
- apps/web/src/lib/graph/selection.ts

## Planned changes

1. Split expensive graph preparation/layout from lightweight UI-state decoration.
2. Cache prepared graph data and layout results by bundle identity.
3. Recompute edge/node highlight state without rebuilding the entire graph.
4. Validate with checks/build and update current state notes.

## Validation

Commands to run:

```bash
pnpm --filter web check
pnpm --filter web build
```

Expected results:

- Web checks pass with no warnings.
- Web build passes.
- Graph selection and overlay changes no longer trigger full layout work for unchanged bundles.

## Risks

- Cached graph state can become stale if cache keys are too weak.
- Reusing graph objects unsafely could leak UI state between renders.

## Rollback

- Revert the `StaticLifeMap.svelte` and graph-helper changes from this pass.
- Remove this ExecPlan if the work is abandoned.

## Completion notes

- Completed:
  - Split expensive graph preparation/layout from lightweight selection, hover, and preview decoration in `StaticLifeMap.svelte`.
  - Added cached bundle artifacts for progression maps and lane guides so repeated reads of the same graph avoid rebuilding those structures.
  - Added layout-result caching and safe cloning so unchanged bundles reuse prior layout work instead of recalculating positions.
  - Reused the progression incoming map during selection highlighting so active-path updates no longer rebuild the traversal index every time.
- Tests run:
  - `pnpm --filter web check`
  - `pnpm --filter web build`
- Known gaps:
  - This pass removes obvious recomputation waste, but it does not yet add virtualization or viewport-aware rendering for very large graphs.
  - Initial load bundle size remains relatively large; a later pass should focus on code-splitting and dependency trimming.
