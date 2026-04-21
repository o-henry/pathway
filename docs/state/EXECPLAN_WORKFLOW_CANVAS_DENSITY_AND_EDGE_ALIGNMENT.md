# ExecPlan: Workflow Canvas Density And Edge Alignment

## Goal

Reduce wasted vertical space in the Pathway workflow canvas and make pathway edge routing feel visibly more aligned and intentional.

## Context

- The workflow screen is graph-first, so empty vertical bands above the active map weaken the primary workspace.
- The current pathway edge renderer mixes per-edge lane choices, which makes shared branch trunks look uneven.
- The relevant files are `apps/desktop/src/app/PathwayRailCanvas.tsx`, `apps/desktop/src/features/workflow/graph-utils/renderEdges.ts`, and `docs/state/CURRENT_STATE.md`.

## Non-goals

- Redesigning the workflow inspector or request form.
- Replacing the current deterministic layout model.
- Adding new graph interactions.

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
- apps/desktop/src/app/MainAppImpl.tsx
- apps/desktop/src/app/PathwayRailCanvas.tsx
- apps/desktop/src/features/workflow/graph-utils/renderEdges.ts
- apps/desktop/src/pathway.css

## Planned changes

1. Pull the Pathway graph upward by reducing internal vertical padding and top-biased viewport fitting.
2. Reduce unnecessary bottom reserve so the request panel sits closer to the canvas.
3. Make bundled pathway edges share a stable routing lane so branch trunks align more cleanly.
4. Remove the old single-edge axis forcing that caused awkward anchor snapping.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- Desktop TypeScript checks pass.
- The graph canvas spends less height on empty top padding.
- Shared branch lines look straighter and more consistently aligned.

## Risks

- Tighter top alignment can feel crowded if future overlays grow taller.
- Shared lane routing may need another pass for especially dense cross-branch graphs.

## Rollback

- Revert `apps/desktop/src/app/PathwayRailCanvas.tsx` and `apps/desktop/src/features/workflow/graph-utils/renderEdges.ts`.

## Completion notes

- Completed:
  - Reduced Pathway canvas top/bottom breathing room and biased auto-fit upward.
  - Added shared lane routing for bundled edges and removed the older per-edge snap forcing.
  - Recorded the change in `docs/state/CURRENT_STATE.md`.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
- Known gaps:
  - No live screenshot verification was run in this sandboxed turn.
