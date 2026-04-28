# ExecPlan: Generation Recovery And Graph Layout

## Goal

Fix the user-visible contradiction where Pathway reports graph generation failure even though a graph was saved, and improve the graph layout so terminal GOAL convergence does not create long vertical edge columns or force route nodes into an unreadable lane.

## Context

- `apps/desktop/src/app/usePathwayMutationController.ts` retries transient local API failures, but if the POST succeeds server-side and the client loses the response, the UI marks the run failed while a later refresh can still load the saved map.
- `apps/desktop/src/app/PathwayRailCanvas.tsx` currently forces direct terminal GOAL parents into one terminal lane and centers all GOAL incoming edge anchors, which makes many branches collapse into tall vertical rails.
- The graph must preserve generated content and only change display/recovery behavior.

## Non-goals

- Do not reduce research quality or remove public/source-library research.
- Do not hardcode topic-specific graph branches.
- Do not delete existing graph nodes, edges, evidence, or assumptions.

## Files to read

- `AGENTS.md`
- `docs/CODEX_START_HERE.md`
- `docs/PATHWAY_REFRAME.md`
- `docs/DESIGN_RESEARCH_PLAYBOOK.md`
- `docs/DYNAMIC_GRAPH_SPEC.md`
- `docs/RAG_AND_CRAWLING_SPEC.md`
- `docs/state/CURRENT_STATE.md`
- `apps/desktop/src/app/usePathwayMutationController.ts`
- `apps/desktop/src/app/PathwayRailCanvas.tsx`

## Planned changes

1. Track known map IDs before generation and recover a saved map after transient POST failures before showing an error or retrying.
2. Apply the same recovery path to manual graph generation.
3. Keep terminal GOAL display, but stop forcing all GOAL parents into the same final lane.
4. Spread GOAL incoming edge anchors instead of centering every incoming edge on one point.
5. Add focused unit tests for recovery selection and layout depth preservation.

## Validation

Commands to run:

```bash
zsh ./scripts/with-modern-node.sh pnpm --filter web exec vitest --root ../.. --run apps/desktop/src/app/PathwayRailCanvas.test.ts apps/desktop/src/app/usePathwayMutationController.test.ts
pnpm --filter desktop exec tsc --noEmit
git diff --check
pnpm secret-scan
```

Expected results:

- Tests pass.
- TypeScript passes.
- No whitespace errors.
- Secret scan reports no leaks.

## Risks

- Changing layout heuristics can improve the reported graph while shifting previously acceptable maps. Tests will pin the intended terminal-goal behavior.
- Recovery based on map IDs must avoid selecting stale maps; previous map IDs are captured before generation to keep this deterministic.

## Rollback

- Revert this phase commit to restore previous generation error handling and layout heuristics.

## Completion Notes

- Completed:
  - Added saved-map recovery for transient graph-generation failures so a server-side successful POST is treated as success if a new map appears.
  - Applied the recovery path to both intake-driven and manual graph generation.
  - Changed Pathway layout so direct terminal GOAL parents keep their natural graph depth instead of being forced into one terminal lane.
  - Switched GOAL incoming edges from one centered target anchor to separated target anchors.
  - Added focused tests for recovered map selection and terminal route layout.
- Follow-up completed:
  - Replaced the display-only terminal GOAL strategy with a single primary GOAL node. When generation already emits a goal node, Pathway now marks that generated node as the display goal instead of adding another GOAL.
  - Removed existing display-only terminal GOAL nodes from cloned display bundles so old saved maps do not keep rendering duplicate goals.
  - Reoriented generated-goal maps into one readable route tree connected to a single GOAL, while still preserving the original GraphBundle nodes and edges.
  - Moved isolated context-only nodes into a right-side context grid to keep evidence/risk/assumption notes from creating unreadable vertical route rails.
  - Verified a real local API generation run for `goal_c2ac0e8a99a84446b44226bbada333bf`: `map_e11e01327adb47eb81c5fddcea75403d`, HTTP `201`, `677.032221s`, 20 nodes, 26 route edges, 7 evidence items, and zero metadata-only evidence refs.
  - Verified the generated map in the dev UI: one GOAL rendered, no visible node overlaps in the checked viewport, no "local API disconnected" text, and no "backend not ready" text.
- Tests run:
  - `zsh ./scripts/with-modern-node.sh pnpm --filter web exec vitest --root ../.. --run apps/desktop/src/app/PathwayRailCanvas.test.ts apps/desktop/src/app/usePathwayMutationController.test.ts`
  - `pnpm --filter desktop typecheck`
  - `git diff --check`
  - `pnpm secret-scan`
- Known gaps:
  - This phase fixes client recovery and display routing. It does not yet add a full browser visual regression test for the exact user screenshot.
