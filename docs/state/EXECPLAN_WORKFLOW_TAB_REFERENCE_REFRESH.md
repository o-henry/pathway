# ExecPlan: Workflow Tab Reference Refresh

## Goal

Make the Pathway desktop `workflow` tab feel closer to the provided branching reference: lighter canvas, compact branch chips, softer connectors, and less workflow-engine chrome.

## Context

- The current desktop workflow tab already renders Pathway bundles through `PathwayRailCanvas`.
- The weak point is presentation, not core graph data flow.
- The reference image shows a left-to-right branching map with compact labels, restrained pastel tones, and minimal surrounding controls.

## Non-goals

- Do not rewrite the upstream RAIL runtime.
- Do not replace the Pathway data model.
- Do not add new graph-editing features.

## Files to read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/PATHWAY_REFRAME.md
- docs/DESIGN_RESEARCH_PLAYBOOK.md
- docs/phases/phase-02-static-life-map-ui.md
- docs/state/CURRENT_STATE.md
- apps/desktop/src/app/PathwayRailCanvas.tsx
- apps/desktop/src/app/main/presentation/WorkflowCanvasPane.tsx
- apps/desktop/src/app/main/presentation/WorkflowCanvasNodesLayer.tsx
- apps/desktop/src/pathway.css

## Planned changes

1. Add a Pathway presentation mode to the shared workflow canvas pane so the graph can render with reduced chrome.
2. Replace Pathway node cards with compact branch-chip styling and pass per-node depth/size metadata from `PathwayRailCanvas`.
3. Retune Pathway layout spacing and canvas styling so the branch map feels closer to the provided reference.
4. Validate with desktop typecheck/build and update state notes.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
pnpm --filter desktop build
```

Expected results:

- Desktop typecheck passes.
- Desktop production build passes.
- Pathway workflow canvas uses the new reduced-chrome branch presentation without breaking the shared workflow runtime.

## Risks

- Compact chips can truncate longer real node labels more aggressively than the current cards.
- Pathway-specific overrides may drift if the upstream workflow canvas markup changes later.

## Rollback

- Revert the `PathwayRailCanvas`, `WorkflowCanvasPane`, `WorkflowCanvasNodesLayer`, and `pathway.css` edits.
- Remove this ExecPlan if the task is abandoned.

## Completion notes

- Completed:
  - Added a Pathway-specific workflow canvas presentation mode that removes composer/runbar chrome from the read-only branch map view.
  - Swapped Pathway nodes from workflow cards to compact branch-chip rendering with depth/family-aware styling hooks.
  - Retuned Pathway layout spacing and per-node visual sizing so connectors and chips read more like the provided branching reference.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
  - `pnpm --filter desktop build`
- Known gaps:
  - Compact chip widths are still heuristic and may need smarter text measurement for longer live node titles.
  - I validated through typecheck/build rather than a fresh runtime screenshot in this sandboxed session.
