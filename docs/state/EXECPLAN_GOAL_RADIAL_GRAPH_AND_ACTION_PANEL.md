# ExecPlan: Goal Radial Graph And Action Panel

## Goal

Replace the left-to-right Pathway graph display with a GOAL-centered radial/mind-map layout and reduce the inspector panel to practical, node-specific action guidance.

## Context

- The current generated graph still reads like a left-anchored flowchart.
- The user wants branches distributed around GOAL, like a mind map across multiple quadrants.
- The inspector panel currently shows several low-value sections before or around the practical execution content.
- Existing graph data must be preserved; this phase changes display layout and panel presentation only.

## Non-goals

- Do not change graph generation prompts, RAG, persistence, or GraphBundle data.
- Do not hardcode English-learning route semantics.
- Do not delete graph nodes, evidence, assumptions, or state history.

## Files to read

- `docs/PATHWAY_REFRAME.md`
- `docs/DESIGN_RESEARCH_PLAYBOOK.md`
- `docs/DYNAMIC_GRAPH_SPEC.md`
- `docs/phases/phase-02-static-life-map-ui.md`
- `docs/state/CURRENT_STATE.md`
- `apps/desktop/src/app/PathwayRailCanvas.tsx`
- `apps/desktop/src/app/PathwayRailCanvas.test.ts`
- `apps/desktop/src/app/PathwayWorkflowPanel.tsx`
- `apps/desktop/src/app/pathwayWorkspaceUtils.ts`
- `apps/desktop/src/pathway.css`

## Planned changes

1. Add a GOAL-centered radial layout pass that places primary branches in right, left, top, and bottom sectors.
2. Route edge anchors by actual geometry so connections can enter GOAL from multiple sides.
3. Rework initial viewport focus around the radial graph center instead of left flow lanes.
4. Strip low-value inspector sections and prioritize actionable fields: immediate step, method, success check, record-after, assumptions, and grounded evidence.
5. Add tests for radial quadrant distribution, GOAL centeredness, and reduced visible node fields.

## Validation

Commands to run:

```bash
zsh ./scripts/with-modern-node.sh pnpm --filter web exec vitest --root ../.. --run apps/desktop/src/app/PathwayRailCanvas.test.ts
pnpm --filter desktop exec tsc --noEmit
git diff --check
pnpm secret-scan
```

Expected results:

- Unit tests pass.
- Desktop typecheck passes.
- Browser verification shows no node overlap and branches in multiple quadrants around GOAL.

## Risks

- Radial layout can increase canvas dimensions. The initial viewport should center GOAL and keep branches readable rather than compress the whole map.
- Existing graph edge direction may still be data-directed, but visual anchoring should read as branches relating to the central GOAL.

## Rollback

- Revert this phase patch to restore the previous left-to-right route layout and fuller inspector panel.

## Completion notes

- Completed:
  - Replaced the Pathway left-to-right display with a GOAL-centered radial layout pass that assigns primary graph nodes into four sectors: upper-right, lower-right, upper-left, and lower-left.
  - Changed displayed Pathway edges to radial spokes from visible non-context nodes into the central GOAL, while preserving the underlying `GraphBundle` nodes, edges, evidence, assumptions, and route history.
  - Reworked edge-side resolution and rendered Pathway route lines as straight geometry-based connectors.
  - Tightened the initial viewport so the radial graph opens at a readable overview zoom, excludes context-only nodes from the initial focus, and avoids the left canvas controls.
  - Reduced the selected-node inspector to actionable guidance first, followed by the node rationale and supporting content evidence.
  - Removed the raw node-data dump, metadata-only evidence list, summary count cards, and empty assumption section from selected-node view.
  - Added fallback action guidance so nodes without dedicated execution fields still show a minimum action instead of telling the user to regenerate the graph.
- Tests run:
  - `zsh ./scripts/with-modern-node.sh pnpm --filter web exec vitest --root ../.. --run apps/desktop/src/app/PathwayRailCanvas.test.ts apps/desktop/src/app/pathwayWorkspaceUtils.test.ts`
  - `pnpm --filter desktop exec tsc --noEmit`
  - Playwright browser verification against `http://127.0.0.1:1420/`
  - `git diff --check`
- Known gaps:
  - The radial display intentionally simplifies visible edges into GOAL spokes for readability; the complete progression graph remains in the bundle but is not all drawn in the main canvas.
  - Evidence text can still be long when source summaries are long; it is now below the action section rather than competing with the first next step.
