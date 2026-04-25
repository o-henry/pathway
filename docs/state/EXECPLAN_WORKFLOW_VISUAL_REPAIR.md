# ExecPlan: Workflow Node Overlap Repair

## Goal

Make the desktop Pathway workflow graph readable and prevent nodes from overlapping each other or adjacent chrome when a graph is open.

## Context

The current workflow screenshot shows the graph-first structure, but the layout can stack same-lane nodes too tightly and auto-open the inspector, shrinking the canvas until nodes appear under controls or panel chrome.

## Non-goals

- Do not change graph generation, RAG, persistence, or revision semantics.
- Do not redesign the desktop shell outside the Pathway workflow surface.
- Do not delete graph material or alter stored map data.

## Files to read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/PATHWAY_REFRAME.md
- docs/DESIGN_RESEARCH_PLAYBOOK.md
- docs/phases/phase-02-static-life-map-ui.md
- docs/state/CURRENT_STATE.md
- apps/desktop/src/pathway.css
- apps/desktop/src/styles/tokens/theme.css
- apps/desktop/src/app/PathwayRailCanvas.tsx

## Planned changes

1. Calculate same-lane vertical spacing from node heights instead of a fixed tiny row delta.
2. Reduce node footprints enough for compact route maps to fit without clipping.
3. Keep the inspector closed by default so node selection does not immediately shrink the graph canvas.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
npm_config_cache=/tmp/npm-cache /Users/henry/.codex/skills/playwright/scripts/playwright_cli.sh screenshot --filename output/playwright/pathway-after-fix.png
```

Expected results:

- TypeScript passes.
- The workflow screenshot shows readable Korean text, visible graph nodes, and less obstruction from the update composer.

## Risks

- Compact node footprints shorten long labels with ellipsis; full labels remain available through title/selection affordances.
- Existing user pan/zoom state may remain until a graph reload because manual viewport touches are preserved.

## Rollback

- Revert changes in `apps/desktop/src/pathway.css`, `apps/desktop/src/app/PathwayRailCanvas.tsx`, and this ExecPlan.

## Completion notes

- Completed:
  - Same-lane node spacing now uses node heights plus a visible gap, preventing overlap when siblings share similar parent rows.
  - Pathway node footprint widths were tightened and the canvas min zoom was lowered so graphs fit in the visible canvas instead of sliding under side chrome.
  - The workflow inspector no longer opens automatically on graph load or node selection; the graph stays dominant until the user explicitly opens the inspector.
  - Follow-up reference-match pass retuned the graph toward the supplied Image #2: root nodes now align to the left edge of their lane, columns are wider, the lower branch sits on a distinct bottom row, and initial fit biases the graph upward to match the reference framing.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
  - Playwright screenshot checks for default graph view and inspector-open view.
  - Playwright DOM overlap check returned `count: 8` and `overlaps: []`.
  - Playwright reference-layout check on the English 6-node graph returned no node overlaps.
- Known gaps:
  - The desktop-specific graph layout still lacks a configured unit-test script; overlap was verified in the live browser instead.
