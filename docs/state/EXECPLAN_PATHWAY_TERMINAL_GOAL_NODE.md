# ExecPlan: Pathway Terminal Goal Node

## Goal

Render the user's goal as a distinct GOAL node on the far right of the Pathway graph, with visible progression routes converging into it.

## Context

- `PathwayRailCanvas` currently lays out progression edges directly from the active `GraphBundle`.
- Existing demo and generated bundles often model the goal as the starting node, which puts it on the left.
- The user wants the graph to read as routes/options flowing toward the final goal.

## Non-goals

- Rewriting backend graph generation or stored graph history in this pass.
- Replacing the existing manual layout engine.
- Changing non-progression reference edges.

## Files to Read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/PATHWAY_REFRAME.md
- docs/DESIGN_RESEARCH_PLAYBOOK.md
- docs/DYNAMIC_GRAPH_SPEC.md
- apps/desktop/src/app/PathwayRailCanvas.tsx
- apps/desktop/src/app/main/presentation/WorkflowCanvasNodesLayer.tsx
- apps/desktop/src/pathway.css

## Planned Changes

1. Pass the active user goal title into the Pathway canvas.
2. Add a display-only bundle normalization step that ensures a GOAL node exists, has the user's goal text, has no outgoing progression edges, and receives progression edges from final non-goal branch nodes.
3. Style GOAL nodes with a distinct visual treatment.
4. Run desktop typecheck and update current state.

## Validation

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- Desktop TypeScript checks pass.
- The graph layout places GOAL in the rightmost lane because final progression edges target it.

## Risks

- Existing stored bundles are not rewritten, so exports will still reflect their original edge direction until backend generation is updated.

## Rollback

- Revert `apps/desktop/src/app/PathwayRailCanvas.tsx`, `apps/desktop/src/app/MainAppImpl.tsx`, `apps/desktop/src/app/main/presentation/WorkflowCanvasNodesLayer.tsx`, and `apps/desktop/src/pathway.css`.

## Completion Notes

- Completed:
  - Added a display-bundle normalization step that makes the user's GOAL node the terminal node for Pathway progression rendering.
  - Removed outgoing progression edges from the displayed GOAL node and connected final non-goal branch nodes into GOAL.
  - Passed the active user goal title into the display bundle so the GOAL node label reflects what the user typed.
  - Added a distinct GOAL marker and darker green terminal styling.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
- Known gaps:
  - This pass normalizes the desktop canvas display; it does not rewrite stored graph bundles or backend generation prompts yet.
  - No fresh live screenshot verification was run in this turn.
