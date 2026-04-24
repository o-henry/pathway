# ExecPlan: Pathway Straight Edge Routing

## Goal

Remove step-like orthogonal routing from the Pathway graph so progression edges read as direct visual relationships, especially where multiple route branches converge into GOAL.

## Context

- The shared workflow edge renderer bundles edges into orthogonal lanes when multiple edges share a source or target.
- On Pathway maps, that bundling made route convergence look like a confusing shared trunk with right-angle turns.
- The user wants Pathway route lines to be straight rather than stair-stepped.

## Non-goals

- Changing the general workflow graph routing.
- Rewriting the Pathway layout algorithm.
- Changing graph semantics or stored graph bundles.

## Files To Read

- apps/desktop/src/features/workflow/graph-utils/renderEdges.ts
- apps/desktop/src/app/PathwayRailCanvas.tsx

## Planned Changes

1. Add a `routeStyle` option to the shared edge-line builder.
2. Keep the default `orthogonal` route style for existing workflow usage.
3. Opt Pathway canvas rendering into `straight` routes.

## Validation

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- Desktop TypeScript passes.
- Pathway edges render as direct straight segments instead of bundled right-angle paths.

## Risks

- Dense graphs may show more crossing lines; this is preferable to misleading step-shaped shared trunks for the current Pathway map.

## Rollback

- Remove the `routeStyle` option and Pathway `routeStyle: "straight"` call site.

## Completion Notes

- Completed:
  - Added `routeStyle?: "orthogonal" | "straight"` to `buildCanvasEdgeLines`.
  - Pathway now calls the edge renderer with `routeStyle: "straight"`.
  - Verified with a browser screenshot that route convergence no longer uses the stair-step trunk.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
  - Playwright screenshot: `output/playwright/pathway-straight-edges.png`
- Known gaps:
  - Straight lines can cross on dense maps; a later pass can add slight curved or fanned straight-line variants if needed without returning to stair-step routing.
