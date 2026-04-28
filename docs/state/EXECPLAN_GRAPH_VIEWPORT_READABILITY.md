# ExecPlan: Graph Viewport Readability

## Goal

Make generated Pathway graphs readable on first render by focusing the initial viewport on the main route graph, avoiding unreadably low zoom, and letting node labels show enough text to scan.

## Context

- The latest screenshot shows the graph rendered as tiny nodes in the upper-left portion of a large canvas.
- `apps/desktop/src/app/PathwayRailCanvas.tsx` currently fits all visible nodes, including isolated context nodes, and permits a `0.5` zoom floor.
- Isolated context-only nodes are useful, but they should not force the route map into a miniaturized overview.
- The graph data must be preserved; this phase only changes display layout and initial viewport behavior.

## Non-goals

- Do not change graph generation, evidence selection, or persistence.
- Do not delete, hide, or overwrite generated graph nodes.
- Do not introduce topic-specific route layout rules.

## Files to read

- `AGENTS.md`
- `docs/CODEX_START_HERE.md`
- `docs/PATHWAY_REFRAME.md`
- `docs/DESIGN_RESEARCH_PLAYBOOK.md`
- `docs/DYNAMIC_GRAPH_SPEC.md`
- `docs/phases/phase-02-static-life-map-ui.md`
- `docs/state/CURRENT_STATE.md`
- `apps/desktop/src/app/PathwayRailCanvas.tsx`
- `apps/desktop/src/app/PathwayRailCanvas.test.ts`
- `apps/desktop/src/pathway.css`

## Planned changes

1. Mark isolated context-grid nodes in the Pathway layout metadata.
2. Compute initial viewport focus bounds from non-context route nodes, falling back to all nodes when needed.
3. Enforce a readable initial zoom floor and anchor oversized route graphs from the left/top instead of shrinking the whole map.
4. Increase Pathway node footprint slightly and allow two-line labels so Korean route text is legible.
5. Add focused tests for context metadata and initial viewport behavior.

## Validation

Commands to run:

```bash
zsh ./scripts/with-modern-node.sh pnpm --filter web exec vitest --root ../.. --run apps/desktop/src/app/PathwayRailCanvas.test.ts
pnpm --filter desktop exec tsc --noEmit
git diff --check
pnpm secret-scan
```

Expected results:

- PathwayRailCanvas tests pass.
- Desktop TypeScript passes.
- No whitespace errors.
- Secret scan reports no leaks.

## Risks

- Raising the zoom floor means very large graphs require horizontal scrolling, but labels remain readable.
- Wider/taller nodes can expand long maps. The initial viewport should favor scanning the live route over seeing every context note at once.

## Rollback

- Revert this phase patch to restore prior fit-to-all-node zoom behavior and one-line compact nodes.

## Completion notes

- Completed:
  - Marked context-only layout nodes and used those flags to exclude far-right context grids from the initial viewport focus.
  - Added initial viewport helpers with a readable `0.82` zoom floor and left/top anchoring for route graphs wider than the viewport.
  - Increased Pathway node footprints and allowed two-line route labels.
  - Fixed same-lane spacing so nodes are pushed apart after row placement, preventing visual overlap in the generated map.
  - Added tests for context-only metadata, viewport focus bounds, readable initial zoom, and lane overlap prevention.
- Tests run:
  - `zsh ./scripts/with-modern-node.sh pnpm --filter web exec vitest --root ../.. --run apps/desktop/src/app/PathwayRailCanvas.test.ts`
  - `pnpm --filter desktop exec tsc --noEmit`
  - Browser/Playwright verification against `http://127.0.0.1:1420/`; generated English-conversation graph rendered 20 nodes at `0.82` zoom with zero DOM overlaps.
  - `git diff --check`
  - `pnpm secret-scan`
- Known gaps:
  - Very wide graphs now favor readable scrolling over full-map overview. A future minimap or overview affordance would complement this.
