# ExecPlan: Workflow Graph-First Redesign

## Goal

Make the desktop workflow tab feel like a graph workspace instead of a stacked dashboard by giving the map most of the screen, collapsing support information into one contextual sidebar, and scaling the canvas so real nodes occupy meaningful visual space.

## Context

Relevant files:

- `AGENTS.md`
- `docs/PATHWAY_REFRAME.md`
- `docs/DESIGN_RESEARCH_PLAYBOOK.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/state/CURRENT_STATE.md`
- `apps/desktop/src/app/MainAppImpl.tsx`
- `apps/desktop/src/app/PathwayRailCanvas.tsx`
- `apps/desktop/src/app/main/presentation/WorkflowCanvasPane.tsx`
- `apps/desktop/src/pathway.css`

The previous workflow pass improved overlays and edge rendering, but the screen still had three structural issues:

1. the graph occupied too little of the canvas
2. the right-side cards and bottom form felt disconnected from the map
3. the canvas stage remained oversized relative to the actual graph content

## Non-goals

- Replacing the graph data model
- Reworking backend revision logic
- Adding new workflow tabs or new API endpoints

## Planned changes

1. Replace the split rail + inspector + bottom request form with one contextual workflow sidebar.
2. Compress the in-canvas summary into a smaller status block that supports the graph instead of overpowering it.
3. Tighten Pathway stage sizing, node spacing, and auto-fit so sparse graphs scale up more aggressively.
4. Move canvas controls closer together so action and zoom affordances read as one system.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- Desktop TypeScript passes.
- Workflow graph, sidebar, and request composer compile with no unused legacy rail state.

## Risks

- A denser auto-fit pass can over-zoom wider graphs if the bounds calculation is wrong.
- Folding multiple panels into one sidebar can create overflow issues on shorter screens.

## Rollback

- Revert `MainAppImpl.tsx`, `PathwayRailCanvas.tsx`, `WorkflowCanvasPane.tsx`, and `pathway.css` together.

## Completion notes

- Completed: Graph-first workflow layout pass with a single contextual sidebar, denser canvas fit, and consolidated canvas controls.
- Tests run: `pnpm --filter desktop exec tsc --noEmit`
- Known gaps: Live visual validation inside the user’s Tauri window is still needed because this sandbox cannot reliably confirm the rendered macOS window state.
