# ExecPlan: First Tab Preview And Graph Alignment

## Goal

Show a concrete hardcoded first-tab Pathway intake preview and fix two workflow canvas regressions: the upper-left stats strip overlapping the demo graph, and terminal goal edges not entering the goal node as a clean centered horizontal line.

## Context

- The first tab currently has a sparse empty state, which makes it hard to judge the intended Pathway UI/UX before real intake messages exist.
- `PathwayRailCanvas` lays out compact graph chips under a fixed overlay; sparse demo graphs can start too high and visually collide with the overlay.
- Terminal goal nodes use the generic bundled edge router, so incoming goal lines can appear slightly crooked near the final node.

## Non-goals

- Replacing the intake API flow.
- Reworking the entire workflow canvas design.
- Adding new persisted graph data or deleting existing graph history.

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
- docs/phases/phase-02-static-life-map-ui.md
- docs/state/CURRENT_STATE.md
- apps/desktop/src/pages/tasks/TasksPage.tsx
- apps/desktop/src/app/PathwayRailCanvas.tsx
- apps/desktop/src/features/workflow/graph-utils/renderEdges.ts
- apps/desktop/src/pathway.css

## Planned Changes

1. Add a hardcoded Pathway intake preview panel to the first tab empty state.
2. Increase Pathway layout top clearance so the status strip does not cover demo graph nodes.
3. Add a terminal-goal edge rendering hint and honor it in the edge renderer with centered goal entry.
4. Update current state and run desktop typecheck.

## Validation

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- TypeScript passes.
- First tab empty state shows a concrete preview of goal intake, follow-up, approval, and graph handoff.
- Workflow graph nodes begin below the upper-left status strip.
- Edges entering the terminal goal node end on a single horizontal centerline.

## Risks

- Extra top clearance slightly reduces the initial visible graph area on small windows.
- The first-tab preview is intentionally hardcoded and should be removed or replaced once the real transcript design is finalized.

## Rollback

- Revert `TasksPage.tsx`, `PathwayRailCanvas.tsx`, `renderEdges.ts`, `pathway.css`, and this state note.

## Completion Notes

- Completed:
  - Added a hardcoded first-tab Pathway intake preview showing user goal, follow-up checklist, user constraints, and workflow handoff.
  - Raised Pathway graph top layout padding so the upper-left stats strip no longer overlaps the demo graph.
  - Added `forceCenteredTargetEntry` edge-rendering support and used it for Pathway goal nodes so incoming goal edges finish on the card's centerline.
  - Removed the requested borders from the first-tab preview panel, message blocks, and handoff block.
  - Preserved direct parent-child row alignment during layout collision resolution so adjacent connected route nodes render on a straight horizontal line when they share a row.
  - Aligned the terminal goal node to the primary incoming route row so the final route-to-goal connection no longer kinks near the goal card.
  - Verified the first tab and workflow canvas in local Chrome through Playwright-driven screenshots.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
  - `git diff --check`
  - Local Chrome Playwright script against `http://127.0.0.1:1420/`
- Known gaps:
  - The first-tab preview is intentionally hardcoded for UI review and should be replaced with the real persisted intake transcript once that design is approved.
