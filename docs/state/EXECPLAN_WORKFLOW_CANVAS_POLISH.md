# ExecPlan: Workflow Canvas Polish

## Goal

Fix the current Pathway workflow canvas regressions so the graph reads cleanly as the main workspace: no overlay collisions, better short-distance edge routing, correct right-side support rails, and usable fullscreen behavior.

## Context

- `apps/desktop/src/app/MainAppImpl.tsx` renders the workflow shell, rail, inspector, and overlay actions.
- `apps/desktop/src/app/PathwayRailCanvas.tsx` adapts `GraphBundle` data into the shared canvas runtime.
- `apps/desktop/src/app/main/presentation/WorkflowCanvasPane.tsx` owns overlay control placement and fullscreen toggling.
- `apps/desktop/src/app/main/presentation/WorkflowCanvasNodesLayer.tsx` renders Pathway node chrome.
- `apps/desktop/src/features/workflow/graph-utils/renderEdges.ts` generates canvas edge paths.
- `apps/desktop/src/pathway.css` overrides the shared RAIL canvas for Pathway-specific layout and styling.

## Non-goals

- Replacing the deterministic demo graph or the current stub backend flow
- Rebuilding the entire workflow shell from scratch
- Changing the broader desktop navigation model beyond fullscreen hiding

## Files to read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/DESIGN_RESEARCH_PLAYBOOK.md
- docs/state/CURRENT_STATE.md
- apps/desktop/src/app/MainAppImpl.tsx
- apps/desktop/src/app/PathwayRailCanvas.tsx
- apps/desktop/src/app/main/presentation/WorkflowCanvasPane.tsx
- apps/desktop/src/app/main/presentation/WorkflowCanvasNodesLayer.tsx
- apps/desktop/src/features/workflow/graph-utils/renderEdges.ts
- apps/desktop/src/pathway.css

## Planned changes

1. Move Pathway in-canvas action icons to the right side and shift support rail content to the right-side column.
2. Remove misleading decorative node stubs / root kicker text and normalize control radii for canvas controls and node toggle buttons.
3. Improve edge routing for close branch connections so nearby links prefer simple orthogonal lines instead of awkward bundled elbows.
4. Wire Pathway fullscreen mode into the app shell so the graph canvas can take over the whole app surface.
5. Validate visually with live screenshots after implementation.

## Validation

Commands to run:

```bash
pnpm --filter desktop build
pnpm --filter desktop exec vite dev --host 127.0.0.1 --port 4174
```

Expected results:

- Desktop build succeeds.
- Workflow canvas renders without overlay collisions.
- Close branch connections look orthogonal and intentional.
- Fullscreen hides surrounding chrome and expands the canvas.

## Risks

- Shared workflow canvas styles may still leak into Pathway-specific rendering.
- Edge routing changes can make some longer routes look too rigid if thresholds are too aggressive.

## Rollback

- Revert the Pathway-specific changes in `MainAppImpl.tsx`, `PathwayRailCanvas.tsx`, `WorkflowCanvasNodesLayer.tsx`, `renderEdges.ts`, and `pathway.css`.

## Completion notes

- Completed:
- Tests run:
- Known gaps:
