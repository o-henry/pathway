# ExecPlan: Pathway Selection And Canvas Controls

## Goal

Improve the workflow canvas so the graph uses more of the available vertical space, supports drag-box node selection with grouped dragging, and uses the user-provided control icons.

## Context

- `apps/desktop/src/app/PathwayRailCanvas.tsx` already owns Pathway-specific layout, zoom fitting, and node dragging.
- `WorkflowCanvasPane` and `WorkflowCanvasNodesLayer` already support marquee rendering; Pathway was explicitly passing `null`.
- The workflow action buttons in `apps/desktop/src/app/MainAppImpl.tsx` still point at generic SVGs.

## Non-goals

- Reworking the whole graph layout system.
- Adding persistent multi-select state outside the workflow canvas.
- Changing backend graph generation semantics.

## Files to read

- AGENTS.md
- docs/state/CURRENT_STATE.md
- `apps/desktop/src/app/PathwayRailCanvas.tsx`
- `apps/desktop/src/app/MainAppImpl.tsx`
- `apps/desktop/src/app/main/presentation/WorkflowCanvasPane.tsx`
- `apps/desktop/src/app/main/presentation/WorkflowCanvasNodesLayer.tsx`

## Planned changes

1. Reduce Pathway canvas bottom reserve and fit padding so the graph occupies more of the visible canvas.
2. Re-enable marquee selection in `PathwayRailCanvas` and allow selected nodes to drag together.
3. Copy the user-provided SVGs into `apps/desktop/public/` and wire them into the workflow canvas control buttons.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- Desktop TypeScript passes.
- Workflow canvas can render marquee selection.
- Workflow controls resolve to the new SVG assets.

## Risks

- Window-level mouse handlers could interfere with existing drag behavior if cleanup is wrong.
- New icon assets depend on copying files from outside the workspace.

## Rollback

- Revert `PathwayRailCanvas.tsx` marquee and padding changes.
- Restore the previous icon paths in `MainAppImpl.tsx`.
- Remove copied SVGs from `apps/desktop/public/`.

## Completion notes

- Completed:
- Tests run:
- Known gaps:
